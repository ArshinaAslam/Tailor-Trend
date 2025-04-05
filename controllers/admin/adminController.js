const User = require('../../models/userSchema')
const Order = require('../../models/orderSchema')
const Coupon = require('../../models/couponSchema')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const path = require('path');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');




const pageError = async(req,res)=>{
    res.render('adminError')
}




const loadLogin = async(req,res)=>{
    if(req.session.admin){
        res.redirect('/admin/dashboard')
    }else{
        res.render('adminLogin',{message:null})

    }

   
}




const login = async (req, res) => {
    try {
        const { email, password } = req.body;
       
        const admin = await User.findOne({ email, isAdmin: true });
        if (!admin) {
            console.log("Admin not found");
            return res.redirect('/admin/login'); 
        }

        
        const passwordMatch = await bcrypt.compare(password, admin.password);

        if (passwordMatch) {
            req.session.admin = true; 
           
            return res.redirect('/admin/dashboard'); 
        } else {
            console.log("Invalid password");
            return res.render('adminLogin', { message: 'Invaild credentials! '})
        }
    } catch (error) {
        console.error("Login error:", error);
        res.redirect('/pageError');
    }
};





const loadDashboard = async (req, res) => {
  if (!req.session.admin) {
    return res.redirect('/admin/login');
  }

  try {
  
const selectedPeriod = req.query.period || 'all';
let startDate = new Date('2025-01-01'); 
let endDate = new Date(); 


switch (selectedPeriod) {
  case '1day':
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);  
    endDate.setHours(23, 59, 59, 999); 
    break;
  
  case '1week':
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    break;
  
  case '1month':
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    break;
  
  case 'all':
    
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    break;
}

    
    if (req.query.startDate && req.query.endDate) {
      startDate = new Date(req.query.startDate);
      endDate = new Date(req.query.endDate);
      
     
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
    }

    
    if (isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
      return res.status(400).json({ error: 'Invalid date range' });
    }

    
    endDate.setHours(23, 59, 59, 999);

    console.log(`Fetching orders from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    
    const orders = await Order.find({
      createdOn: { $gte: startDate, $lte: endDate }
    }).populate('orderitems.productId', 'productName category').lean();

    console.log(`Found ${orders.length} orders`);

    
    const stats = await Order.aggregate([
      { $match: { createdOn: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$finalAmount" },
          totalDiscount: { $sum: "$discount" }
        }
      }
    ]);

    
    const totalOrders = orders.length;
    const totalSales = orders
      .filter(order => order.status === "Delivered")
      .reduce((sum, order) => sum + (order.finalAmount || 0), 0);

    const totalDiscounts = orders
      .filter(order => order.status === "Delivered")
      .reduce((sum, order) => sum + (order.discount || 0), 0);

    const discountPercentage = totalSales > 0 ? (totalDiscounts / totalSales * 100).toFixed(2) : 0;

    const statusStats = stats.reduce((acc, stat) => {
      acc[stat._id] = { count: stat.count, amount: stat.totalAmount };
      return acc;
    }, {});

    const deliveredOrders = statusStats["Delivered"]?.count || 0;
    const deliveredAmount = statusStats["Delivered"]?.amount || 0;
    const deliveredPercentage = totalOrders > 0 ? (deliveredOrders / totalOrders * 100).toFixed(2) : 0;

    const cancelledOrders = statusStats["Cancelled"]?.count || 0;
    const cancelledAmount = statusStats["Cancelled"]?.amount || 0;
    const cancelledPercentage = totalOrders > 0 ? (cancelledOrders / totalOrders * 100).toFixed(2) : 0;

    const pendingOrders = statusStats["Pending"]?.count || 0;
    const pendingAmount = statusStats["Pending"]?.amount || 0;
    const pendingPercentage = totalOrders > 0 ? (pendingOrders / totalOrders * 100).toFixed(2) : 0;

    const processingOrders = statusStats["Processing"]?.count || 0;
    const processingAmount = statusStats["Processing"]?.amount || 0;
    const processingPercentage = totalOrders > 0 ? (processingOrders / totalOrders * 100).toFixed(2) : 0;

    
    const activeCoupons = await Coupon.countDocuments({
      expireOn: { $gt: new Date() },
      isList: true
    });

    const expiredCoupons = await Coupon.countDocuments({
      expireOn: { $lt: new Date() }
    });

    const totalCouponUsage = orders.filter(order => order.couponApplied).length;

    
    const productStats = await Order.aggregate([
      { $match: { createdOn: { $gte: startDate, $lte: endDate }, status: "Delivered" } },
      { $unwind: "$orderitems" },
      {
        $group: {
          _id: "$orderitems.productId",
          totalQuantitySold: { $sum: "$orderitems.quantity" },
          totalRevenue: { $sum: { $multiply: ["$orderitems.quantity", "$orderitems.price"] } },
          orderCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" },
      {
        $lookup: {
          from: "categories",
          localField: "productInfo.category",
          foreignField: "_id",
          as: "categoryInfo"
        }
      },
      { $unwind: "$categoryInfo" },
      {
        $project: {
          productName: "$productInfo.productName",
          categoryInfo: { name: "$categoryInfo.name" },
          totalQuantitySold: 1,
          totalRevenue: 1,
          orderCount: 1
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

   
    const categoryStats = await Order.aggregate([
      { $match: { createdOn: { $gte: startDate, $lte: endDate }, status: "Delivered" } },
      { $unwind: "$orderitems" },
      {
        $lookup: {
          from: "products",
          localField: "orderitems.productId",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" },
      {
        $group: {
          _id: "$productInfo.category",
          totalQuantitySold: { $sum: "$orderitems.quantity" },
          totalRevenue: { $sum: { $multiply: ["$orderitems.quantity", "$orderitems.price"] } }
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryInfo"
        }
      },
      { $unwind: "$categoryInfo" },
      {
        $project: {
          categoryInfo: { name: "$categoryInfo.name" },
          totalQuantitySold: 1,
          totalRevenue: 1
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 }
    ]);

    
    const monthlySales = await Order.aggregate([
      { $match: { createdOn: { $gte: startDate, $lte: endDate }, status: "Delivered" } },
      {
        $group: {
          _id: { $month: "$createdOn" },
          totalSales: { $sum: "$finalAmount" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

   


    const orderStatusDistribution = stats.map(stat => ({
      status: stat._id || "Unknown",
      count: stat.count,
      amount: stat.totalAmount
    }));
   
    const totalUsers = await mongoose.model('User').countDocuments();

    const dashboardData = {
      data: {
        totalSales: totalSales || 0,
        totalOrders: totalOrders || 0,
        cancelledOrders: cancelledOrders || 0,
        cancelledAmount: cancelledAmount || 0,
        cancelledPercentage: cancelledPercentage || 0,
        pendingOrders: pendingOrders || 0,
        pendingAmount: pendingAmount || 0,
        pendingPercentage: pendingPercentage || 0,
        processingOrders: processingOrders || 0,
        processingAmount: processingAmount || 0,
        processingPercentage: processingPercentage || 0,
        deliveredOrders: deliveredOrders || 0,
        deliveredAmount: deliveredAmount || 0,
        deliveredPercentage: deliveredPercentage || 0,
        totalDiscounts: totalDiscounts || 0,
        discountPercentage: discountPercentage || 0,
        activeCoupons: activeCoupons || 0,
        totalCouponUsage: totalCouponUsage || 0,
        expiredCoupons: expiredCoupons || 0,
        totalUsers: totalUsers || 0,
        selectedPeriod,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      topProducts: productStats || [],
      topCategories: categoryStats || [],
      monthlySales: monthlySales || [],
      orderStatusDistribution: orderStatusDistribution || []
    };

   
    if (req.xhr || req.headers.accept.includes('application/json')) {
      console.log('Sending JSON response for AJAX request');
      return res.json(dashboardData);
    }

   
    res.render('dashboard', dashboardData);
  } catch (error) {
    console.error("Error loading dashboard:", error);
    if (req.xhr || req.headers.accept.includes('application/json')) {
      return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
    res.redirect('/pageError');
  }
};





  const exportExcel = async (req, res) => {
    if (!req.session.admin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  
    try {
      const period = req.query.period || 'all';
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;
  
      let dateFilter = {};
      if (period !== 'all') {
        const today = new Date();
        let fromDate = new Date();
  
        switch (period) {
          case '1day':
        
            fromDate = new Date(today);
            fromDate.setHours(0, 0, 0, 0);
            break;
          case '1week':
            fromDate.setDate(today.getDate() - 7);
            break;
          case '1month':
            fromDate.setMonth(today.getMonth() - 1);
            break;
        }
  
        dateFilter = { createdOn: { $gte: fromDate, $lte: today } };
      } else if (startDate && endDate) {
        dateFilter = {
          createdOn: {
            $gte: new Date(startDate),
            $lte: new Date(new Date(endDate).setHours(23, 59, 59))
          }
        };
      }
  
      dateFilter.status = "Delivered";
  
      const orders = await Order.find(dateFilter)
        .populate('userId', 'name email')
        .populate('address')
        .populate({
          path: 'orderitems.productId',
          select: 'name category price'
        })
        .sort({ createdOn: -1 });
  
      const workbook = new ExcelJS.Workbook();
      
      const summarySheet = workbook.addWorksheet('Orders Summary');
      summarySheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 20 },
        { header: 'Customer', key: 'customer', width: 20 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Total Items', key: 'items', width: 12 },
        { header: 'Total Price', key: 'totalPrice', width: 15 },
        { header: 'Discount', key: 'discount', width: 12 },
        { header: 'Final Amount', key: 'finalAmount', width: 15 },
        { header: 'Payment Method', key: 'paymentMethod', width: 15 }
      ];
  
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0F0FF' }
      };
  
      orders.forEach(order => {
        summarySheet.addRow({
          orderId: order.orderid,
          customer: order.userId ? `${order.userId.name} (${order.userId.email})` : 'N/A',
          date: order.createdOn.toLocaleDateString(),
          status: order.status,
          items: order.orderitems.length,
          totalPrice: `₹${order.totalPrice.toFixed(2)}`,
          discount: `₹${order.discount.toFixed(2)}`,
          finalAmount: `₹${order.finalAmount.toFixed(2)}`,
          paymentMethod: order.paymentMethod
        });
      });
  
      const totalItems = orders.reduce((total, order) => {
        return total + order.orderitems.reduce((sum, item) => sum + (item.quantity || 1), 0);
      }, 0);
  
      const totalAmount = orders.reduce((sum, order) => sum + order.totalPrice, 0);
      const totalDiscount = orders.reduce((sum, order) => sum + order.discount, 0);
      const totalFinalAmount = orders.reduce((sum, order) => sum + order.finalAmount, 0);
  
      summarySheet.addRow([]);
      summarySheet.addRow([]);
      
      const summaryHeadingRow = summarySheet.addRow(['Order Summary']);
      summaryHeadingRow.font = { bold: true, size: 14 };
      summarySheet.addRow([]);
  
      const summaryHeaderRow = summarySheet.addRow(['Description', 'Value']);
      summaryHeaderRow.font = { bold: true };
      summaryHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0F0FF' }
      };
      
      const addSummaryRow = (description, value, isAlternate = false) => {
        const row = summarySheet.addRow([description, value]);
        if (isAlternate) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9F9F9' }
          };
        }
        return row;
      };
  
      addSummaryRow('Total Delivered Orders', orders.length);
      addSummaryRow('Total Items', totalItems, true);
      addSummaryRow('Total Amount', `₹${totalAmount.toFixed(2)}`);
      addSummaryRow('Total Discount', `₹${totalDiscount.toFixed(2)}`, true);
      addSummaryRow('Total Final Amount', `₹${totalFinalAmount.toFixed(2)}`);
  
      const summaryStartRow = summarySheet.rowCount - 4;
      const summaryEndRow = summarySheet.rowCount;
      
      for (let i = summaryStartRow; i <= summaryEndRow; i++) {
        const row = summarySheet.getRow(i);
        row.getCell(1).border = {
          top: {style:'thin'},
          left: {style:'thin'},
          bottom: {style:'thin'},
          right: {style:'thin'}
        };
        row.getCell(2).border = {
          top: {style:'thin'},
          left: {style:'thin'},
          bottom: {style:'thin'},
          right: {style:'thin'}
        };
      }
  
      const detailsSheet = workbook.addWorksheet('Order Details');
      detailsSheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 20 },
        { header: 'Product', key: 'product', width: 30 },
        { header: 'Size', key: 'size', width: 10 },
        { header: 'Quantity', key: 'quantity', width: 10 },
        { header: 'Price', key: 'price', width: 12 },
        { header: 'Item Status', key: 'status', width: 15 },
        { header: 'Return Status', key: 'returnStatus', width: 15 }
      ];
  
      detailsSheet.getRow(1).font = { bold: true };
      detailsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0F0FF' }
      };
  
      orders.forEach(order => {
        order.orderitems.forEach(item => {
          detailsSheet.addRow({
            orderId: order.orderid,
            product: item.productId ? item.productId.name : 'N/A',
            size: item.size || 'N/A',
            quantity: item.quantity,
            price: `₹${item.price.toFixed(2)}`,
            status: item.status || order.status,
            returnStatus: item.returnRequest?.status || 'N/A'
          });
        });
      });
  
      const statsSheet = workbook.addWorksheet('Sales Statistics');
      statsSheet.columns = [
        { header: 'Metric', key: 'metric', width: 25 },
        { header: 'Value', key: 'value', width: 20 }
      ];
  
      statsSheet.getRow(1).font = { bold: true };
      statsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0F0FF' }
      };
  
      const totalSales = orders.reduce((sum, order) => sum + order.finalAmount, 0);
      const totalOrders = orders.length;
      
      const totalDiscounts = orders.reduce((sum, order) => sum + order.discount, 0);
      
      const paymentMethods = {
        'COD': 0,
        'RAZORPAY': 0,
        'WALLET': 0
      };
      
      orders.forEach(order => {
        if (paymentMethods.hasOwnProperty(order.paymentMethod)) {
          paymentMethods[order.paymentMethod]++;
        }
      });
  
      statsSheet.addRow({ metric: 'Total Delivered Sales', value: `₹${totalSales.toFixed(2)}` });
      statsSheet.addRow({ metric: 'Total Delivered Orders', value: totalOrders });
      statsSheet.addRow({ metric: 'Total Discounts', value: `₹${totalDiscounts.toFixed(2)}` });
      
      statsSheet.addRow({ metric: 'Payment Methods', value: '' });
      Object.entries(paymentMethods).forEach(([method, count]) => {
        statsSheet.addRow({ metric: `- ${method}`, value: count });
      });
  
      const orderSummarySheet = workbook.addWorksheet('Order Summary');
      orderSummarySheet.columns = [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Total Orders', key: 'totalOrders', width: 12 },
        { header: 'Total Sales', key: 'totalSales', width: 15 },
        { header: 'Average Order Value', key: 'averageOrderValue', width: 15 },
        { header: 'Delivered Orders', key: 'deliveredOrders', width: 15 },
        { header: 'Delivered Amount', key: 'deliveredAmount', width: 15 }
      ];
  
      orderSummarySheet.getRow(1).font = { bold: true };
      orderSummarySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0F0FF' }
      };
  
      const ordersByDate = {};
      orders.forEach(order => {
        const dateKey = order.createdOn.toISOString().split('T')[0];
        
        if (!ordersByDate[dateKey]) {
          ordersByDate[dateKey] = {
            date: new Date(dateKey).toLocaleDateString(),
            totalOrders: 0,
            totalSales: 0,
            deliveredOrders: 0,
            deliveredAmount: 0
          };
        }
        
        ordersByDate[dateKey].totalOrders++;
        ordersByDate[dateKey].totalSales += order.finalAmount;
        ordersByDate[dateKey].deliveredOrders++;
        ordersByDate[dateKey].deliveredAmount += order.finalAmount;
      });
  
      Object.values(ordersByDate).forEach(summary => {
        orderSummarySheet.addRow({
          date: summary.date,
          totalOrders: summary.totalOrders,
          totalSales: `₹${summary.totalSales.toFixed(2)}`,
          averageOrderValue: `₹${(summary.totalSales / summary.totalOrders).toFixed(2)}`,
          deliveredOrders: summary.deliveredOrders,
          deliveredAmount: `₹${summary.deliveredAmount.toFixed(2)}`
        });
      });
  
      const totalRow = {
        date: 'TOTAL',
        totalOrders: Object.values(ordersByDate).reduce((sum, day) => sum + day.totalOrders, 0),
        totalSales: `₹${Object.values(ordersByDate).reduce((sum, day) => sum + day.totalSales, 0).toFixed(2)}`,
        averageOrderValue: `₹${(Object.values(ordersByDate).reduce((sum, day) => sum + day.totalSales, 0) / 
                          Object.values(ordersByDate).reduce((sum, day) => sum + day.totalOrders, 0)).toFixed(2)}`,
        deliveredOrders: Object.values(ordersByDate).reduce((sum, day) => sum + day.deliveredOrders, 0),
        deliveredAmount: `₹${Object.values(ordersByDate).reduce((sum, day) => sum + day.deliveredAmount, 0).toFixed(2)}`
      };
  
      const totalRowIndex = orderSummarySheet.rowCount + 1;
      orderSummarySheet.addRow(totalRow);
      orderSummarySheet.getRow(totalRowIndex).font = { bold: true };
      orderSummarySheet.getRow(totalRowIndex).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEEEEEE' }
      };
  
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Delivered_Orders_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Error generating Excel report:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to generate Excel report', 
        details: error.message 
      });
    }
  };


  const exportPdf = async (req, res) => {
    if (!req.session.admin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  
    try {
      const period = req.query.period || 'all';
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;
      
      console.log('Export PDF parameters:', { period, startDate, endDate });
  
      let dateFilter = {};
      
      if (period !== 'all') {
        const today = new Date();
        let fromDate = new Date();
  
        switch (period) {
          case '1day':
          
            fromDate = new Date(today);
            fromDate.setHours(0, 0, 0, 0);
            break;
          case '1week':
            fromDate.setDate(today.getDate() - 7);
            break;
          case '1month':
            fromDate.setMonth(today.getMonth() - 1);
            break;
        }
  
        console.log('Period-based date range:', fromDate, 'to', today);
        dateFilter.createdOn = { $gte: fromDate, $lte: today };
      } else if (startDate && endDate) {
        
        console.log('Custom date range:', startDate, 'to', endDate);
        
        try {
          const startDateTime = new Date(startDate);
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999); 
          
          console.log('Parsed dates:', startDateTime, 'to', endDateTime);
          
          if (!isNaN(startDateTime.getTime()) && !isNaN(endDateTime.getTime())) {
            dateFilter.createdOn = {
              $gte: startDateTime,
              $lte: endDateTime
            };
          } else {
            console.warn('Invalid date format for custom range');
          }
        } catch (err) {
          console.error('Error parsing dates:', err);
        }
      }
  
      dateFilter.status = "Delivered";
      
      console.log('MongoDB filter:', JSON.stringify(dateFilter));
  
      const orders = await Order.find(dateFilter)
        .populate('userId', 'name email')
        .populate('address')
        .populate({
          path: 'orderitems.productId',
          select: 'name category price'
        })
        .sort({ createdOn: -1 });
        
      console.log(`Found ${orders.length} orders matching the filter`);
  
      const sum = (arr) => arr.reduce((total, val) => total + val, 0);
  
      const doc = new PDFDocument({
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        size: 'A4',
        layout: 'portrait',
        autoFirstPage: true,
        bufferPages: true 
      });
  
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  
      doc.pipe(res);
  
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  
      doc.fontSize(16).font('Helvetica-Bold').text('TAILOR TREND', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(0.5);
  
      if (period !== 'all' && (!startDate || !endDate)) {
        const periodText = {
          '1day': 'Today',  
          '1week': 'Last 7 Days',
          '1month': 'Last 30 Days',
          'all': 'All Time'
        };
        doc.fontSize(9).text(`Sales Report Period: ${periodText[period] || period}`, { align: 'left' });
      } else if (startDate && endDate) {
        // doc.fontSize(9).text(`Date Range: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`, { align: 'left' });
      } else {
        doc.fontSize(9).text('Sales Report Period: All Time', { align: 'left' });
      }
      
      // doc.text(`Status: Delivered Orders Only`, { align: 'left' });
  
      doc.moveDown(0.2);
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
      doc.moveDown(0.5);
  
      doc.fontSize(14).font('Helvetica-Bold').text('Sales Report', { align: 'center' });
      doc.moveDown(0.5);
  
      const tableTop = doc.y;
      const tableLeft = doc.page.margins.left + 10;
      
      const totalWidth = pageWidth - 20;
      const colWeights = [12, 15, 8, 8, 5, 9, 9, 9, 9];
      const totalWeight = colWeights.reduce((a, b) => a + b, 0);
      const colWidths = colWeights.map(w => Math.floor((w / totalWeight) * totalWidth));
      
      const rowHeight = 20;
  
      const headers = [
        'Order ID', 'Customer', 'Date', 'Status', 'Items', 
        'Total Price', 'Discount', 'Final Amount', 'Payment'
      ];
  
      const drawTableHeader = (headers, x, y, colWidths, rowHeight) => {
        doc.fillColor('#E0F0FF').rect(x, y, sum(colWidths), rowHeight).fill();
        doc.fillColor('#000000');
  
        doc.font('Helvetica-Bold').fontSize(8);
        headers.forEach((header, i) => {
          let cellX = x;
          for (let j = 0; j < i; j++) {
            cellX += colWidths[j];
          }
          doc.text(header, cellX + 2, y + 6, { width: colWidths[i] - 4, align: 'center' });
        });
  
        doc.strokeColor('#000000').lineWidth(0.5);
        doc.rect(x, y, sum(colWidths), rowHeight).stroke();
  
        let xPos = x;
        for (let i = 0; i < colWidths.length - 1; i++) {
          xPos += colWidths[i];
          doc.moveTo(xPos, y).lineTo(xPos, y + rowHeight).stroke();
        }
  
        return y + rowHeight;
      };
  
      let currentY = drawTableHeader(headers, tableLeft, tableTop, colWidths, rowHeight);
      doc.font('Helvetica').fontSize(7);
  
      const maxOrdersToDisplay = Math.min(orders.length, 6);
      
      let rowCount = 0;
      for (let i = 0; i < maxOrdersToDisplay; i++) {
        const order = orders[i];
        
        if (rowCount % 2 === 1) {
          doc.fillColor('#F9F9F9').rect(tableLeft, currentY, sum(colWidths), rowHeight).fill();
        }
        doc.fillColor('#000000');
  
        const orderTotal = order.totalPrice || 0;
        const orderDiscount = order.discount || 0;
        const orderFinal = order.finalAmount || 0;
        const orderItems = order.orderitems || [];
        const orderDate = order.createdOn ? new Date(order.createdOn).toLocaleDateString() : 'N/A';
        const customerName = order.userId?.name || 'N/A';
        const customerEmail = order.userId?.email || '';
        const customerDisplay = customerEmail ? `${customerName}` : customerName;
  
        const rowData = [
          order.orderid || 'N/A',
          customerDisplay,
          orderDate,
          order.status || 'N/A',
          orderItems.length.toString(),
          `₹${orderTotal.toFixed(2)}`,
          `₹${orderDiscount.toFixed(2)}`,
          `₹${orderFinal.toFixed(2)}`,
          order.paymentMethod || 'N/A'
        ];
  
        rowData.forEach((text, i) => {
          let cellX = tableLeft;
          for (let j = 0; j < i; j++) {
            cellX += colWidths[j];
          }
          
          let align = 'left';
          if (i === 4) { 
            align = 'center';
          }
          
          doc.text(String(text), cellX + 2, currentY + 6, { 
            width: colWidths[i] - 4,
            align: align,
            ellipsis: true 
          });
        });
  
        doc.rect(tableLeft, currentY, sum(colWidths), rowHeight).stroke();
  
        let xPosRow = tableLeft;
        for (let i = 0; i < colWidths.length - 1; i++) {
          xPosRow += colWidths[i];
          doc.moveTo(xPosRow, currentY).lineTo(xPosRow, currentY + rowHeight).stroke();
        }
  
        currentY += rowHeight;
        rowCount++;
      }
  
      currentY += 30;
      
      const totalItems = orders.reduce((total, order) => {
        const orderItems = order.orderitems || [];
        return total + orderItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
      }, 0);
  
      const totalAmount = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
      const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);
      const totalFinalAmount = orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);
  
      const summaryTableTop = currentY;
      const summaryTableWidth = Math.min(400, pageWidth);
      const summaryTableLeft = doc.page.margins.left + (pageWidth - summaryTableWidth) / 2;
      const summaryColWidths = [summaryTableWidth * 0.6, summaryTableWidth * 0.4];
      const summaryRowHeight = 20;
  
      doc.fillColor('#E0F0FF').rect(summaryTableLeft, summaryTableTop, sum(summaryColWidths), summaryRowHeight).fill();
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9);
      doc.text('Sales Summary (Delivered Orders)', summaryTableLeft + 10, summaryTableTop + 6, { width: summaryColWidths[0] - 10 });
      doc.text('Value', summaryTableLeft + summaryColWidths[0] + 10, summaryTableTop + 6, { width: summaryColWidths[1] - 10 });
  
      doc.rect(summaryTableLeft, summaryTableTop, sum(summaryColWidths), summaryRowHeight).stroke();
      doc.moveTo(summaryTableLeft + summaryColWidths[0], summaryTableTop)
        .lineTo(summaryTableLeft + summaryColWidths[0], summaryTableTop + summaryRowHeight)
        .stroke();
  
      let summaryRowY = summaryTableTop + summaryRowHeight;
      doc.font('Helvetica');
  
      const addSummaryRow = (label, value, isAlternate = false) => {
        if (isAlternate) {
          doc.fillColor('#F9F9F9').rect(summaryTableLeft, summaryRowY, sum(summaryColWidths), summaryRowHeight).fill();
        }
        doc.fillColor('#000000');
  
        doc.text(label, summaryTableLeft + 10, summaryRowY + 6, { width: summaryColWidths[0] - 20 });
        doc.text(value, summaryTableLeft + summaryColWidths[0] + 10, summaryRowY + 6, { width: summaryColWidths[1] - 20 });
  
        doc.rect(summaryTableLeft, summaryRowY, sum(summaryColWidths), summaryRowHeight).stroke();
        doc.moveTo(summaryTableLeft + summaryColWidths[0], summaryRowY)
          .lineTo(summaryTableLeft + summaryColWidths[0], summaryRowY + summaryRowHeight)
          .stroke();
  
        summaryRowY += summaryRowHeight;
      };
  
      addSummaryRow('Total Delivered Orders', orders.length.toString());
      addSummaryRow('Total Items Sold', totalItems.toString(), true);
      addSummaryRow('Total Sales Amount', `₹${totalAmount.toFixed(2)}`);
      addSummaryRow('Total Discount Applied', `₹${totalDiscount.toFixed(2)}`, true);
      addSummaryRow('Total Revenue', `₹${totalFinalAmount.toFixed(2)}`);
  
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).text(
          `Page ${i + 1} of ${totalPages}`,
          doc.page.margins.left,
          doc.page.height - 30,
          { align: 'center', width: pageWidth }
        );
      }
  
      doc.fontSize(8).text(
        `Sales Report Generated: ${new Date().toLocaleString()}`,
        doc.page.margins.left,
        doc.page.height - 20,
        { align: 'center', width: pageWidth }
      );
  
      doc.end();
    } catch (error) {
      console.error('Error generating PDF report:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to generate sales report', 
        error: error.message 
      });
    }
  };
  
  
  function sum(arr) {
    return arr.reduce((a, b) => a + b, 0);
  }


  const salesReport = async(req,res)=>{     
    try {
      const {
        period = 'all',
        startDate,
        endDate,
        page = 1
      } = req.query;
  
      const limit = 5; 
      let query = { status: 'Delivered' };
  
    
      const now = new Date();
      switch (period) {
        case '1day':
          query.createdOn = { 
            $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) 
          };
          break;
        case '1week':
          query.createdOn = { 
            $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) 
          };
          break;
        case '1month':
          query.createdOn = { 
            $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) 
          };
          break;
        case 'custom':
          if (startDate && endDate) {
            query.createdOn = {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            };
          }
          break;
        
      }
  
    
      const totalOrders = await Order.countDocuments(query);
      const totalPages = Math.ceil(totalOrders / limit);
      const currentPage = parseInt(page, 10) || 1;
  
      
      const salesData = await Order.find(query)
        .populate('userId', 'name')
        .populate('address')
        .skip((currentPage - 1) * limit)
        .limit(limit)
        .sort({ createdOn: -1 });
  
      
      const totalSales = await Order.aggregate([
        { $match: query },
        { $group: { 
            _id: null, 
            totalRevenue: { $sum: '$finalAmount' },
            totalOrders: { $sum: 1 },
            totalDiscount:{ $sum: '$discount'}
          } 
        }
      ]);
  
      
      res.render('salesReport', {
        sales: salesData,
        period: period || 'all',
        startDate: startDate || '',
        endDate: endDate || '',
        currentPage,
        totalPages,
        totalOrders,
        totalSales: totalSales[0] ? totalSales[0].totalRevenue : 0,
        totalOrderCount: totalSales[0] ? totalSales[0].totalOrders : 0,
        totalDiscount : totalSales[0] ? totalSales[0].totalDiscount : 0,
        limit
      });
    } catch (error) {
      console.error('Error fetching sales report:', error);
      res.status(500).send('Error generating sales report');
    }
  }


  


const logout = async (req,res)=>{
    try{
        req.session.destroy(err=>{
            if(err){
                console.log("Error destroying session",err)
                res.redirect("/pageError")
            }else{
                res.redirect('/admin/login')
            }
        })

    }catch(error){
        console.log("Unexpected error during logout",error)
        res.redirect('/pageError')


    }
}

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,

    exportExcel,
    exportPdf ,
    salesReport



}