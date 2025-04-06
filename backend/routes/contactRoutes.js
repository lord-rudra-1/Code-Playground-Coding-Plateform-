const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');

// POST /api/contact - Submit contact form
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate input
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields' 
      });
    }

    // Create new contact entry
    const contact = new Contact({
      name,
      email,
      subject,
      message
    });

    // Save to database
    await contact.save();

    res.status(201).json({ 
      success: true, 
      message: 'Your message has been sent successfully!' 
    });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit your message. Please try again later.'
    });
  }
});

module.exports = router; 