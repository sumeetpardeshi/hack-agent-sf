// Updated Cloudflare Worker for Twilio WhatsApp Sandbox with Image Processing

// Import the Unstructured processing function
import { processImageWithUnstructured } from './unstructured';

// Log successful import
console.log('Successfully imported Unstructured module');

// Check API key
function checkUnstructuredApiKey() {
  const apiKey = UNSTRUCTURED_API_KEY;
  console.log('Unstructured API key check:', {
    exists: !!apiKey,
    length: apiKey ? apiKey.length : 0,
    preview: apiKey ? `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}` : 'missing'
  });
  return !!apiKey;
}

// Function to test Unstructured API connection
async function testUnstructuredApi() {
  try {
    console.log('Testing Unstructured API connection...');

    const apiKey = UNSTRUCTURED_API_KEY;
    if (!apiKey) {
      throw new Error('Unstructured API key is missing');
    }

    // Just make a simple request to check API connectivity
    const response = await fetch('https://api.unstructured.io/general/v0/general', {
      method: 'HEAD',  // Just check connectivity, don't send data
      headers: {
        'Accept': 'application/json',
        'unstructured-api-key': apiKey
      }
    });

    console.log('Unstructured API test response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries([...response.headers].map(h => [h[0], h[1]]))
    });

    return response.ok;
  } catch (error) {
    console.error('Error testing Unstructured API:', error.message, error.stack);
    return false;
  }
}

// Enhanced logging function to handle media items
async function logTwilioWebhook(request) {
  try {
    // Parse the form data from Twilio
    const formData = await request.formData();

    // Create an object to store all the form data
    const formDataObj = {};
    for (const [key, value] of formData.entries()) {
      formDataObj[key] = value;
    }

    // Log the entire webhook payload
    console.log('Twilio webhook received:', JSON.stringify(formDataObj, null, 2));

    // Extract key information
    const from = formData.get('From') || 'Unknown';
    const body = formData.get('Body') || '';
    const numMedia = parseInt(formData.get('NumMedia') || '0', 10);

    console.log(`Message from ${from}: "${body}" with ${numMedia} media items`);

    // Extract media information if present
    const mediaItems = [];
    if (numMedia > 0) {
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = formData.get(`MediaUrl${i}`);
        const contentType = formData.get(`MediaContentType${i}`);

        if (mediaUrl) {
          console.log(`Media ${i}: ${mediaUrl} (${contentType})`);
          mediaItems.push({
            url: mediaUrl,
            contentType: contentType || 'application/octet-stream'
          });
        }
      }
    }

    // Return the data for use in responses
    return { from, body, numMedia, mediaItems, formData };
  } catch (error) {
    console.error('Error logging webhook:', error);
    throw error;
  }
}

// Process text commands
function processTextCommand(body) {
  const lowerBody = body.toLowerCase().trim();

  if (lowerBody === 'help' || lowerBody === 'info') {
    return "Welcome to Travel Assistant! Send me your travel documents (flight itineraries, hotel confirmations) as images, and I'll help you keep track of your trip details.";
  }

  if (lowerBody.includes('flight') || lowerBody.includes('plane')) {
    return "To get information about your flights, first send me your flight itinerary as an image. Then I can answer questions about your flights.";
  }

  if (lowerBody.includes('hotel') || lowerBody.includes('stay') || lowerBody.includes('room')) {
    return "To get information about your hotel, first send me your hotel confirmation as an image. Then I can answer questions about your reservation.";
  }

  // Default response for unrecognized commands
  return "I received your message. You can send me travel documents as images, or ask me about your existing travel plans. Type 'help' for more information.";
}

// Function to download and process image from URL
async function processImageFromUrl(mediaUrl, contentType) {
  try {
    console.log(`Downloading image from ${mediaUrl}`);

    // Download the image using fetch
    const response = await fetch(mediaUrl, {
      headers: {
        'Accept': 'image/*'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    // Get image as array buffer
    const imageBuffer = await response.arrayBuffer();

    // Convert to base64
    const base64Image = btoa(
      String.fromCharCode(...new Uint8Array(imageBuffer))
    );

    console.log(`Successfully downloaded image (${imageBuffer.byteLength} bytes)`);

    // Process with Unstructured API
    console.log(`Sending image to Unstructured API for processing`);
    const travelInfo = await processImageWithUnstructured(base64Image, contentType);

    return travelInfo;
  } catch (error) {
    console.error('Error processing image from URL:', error);
    throw error;
  }
}

// Function to generate a user-friendly response from travel info
function generateTravelSummary(travelInfo) {
  let summary = "Here's what I found in your travel document:\n\n";

  // Add flight information
  if (travelInfo.flights && travelInfo.flights.length > 0) {
    summary += "✈️ *Flights*\n";
    travelInfo.flights.forEach((flight, index) => {
      summary += `Flight ${index + 1}: `;

      if (flight.flightNumber) {
        summary += `${flight.flightNumber} `;
      }

      if (flight.departure && flight.arrival) {
        summary += `from ${flight.departure} to ${flight.arrival}`;
      }

      if (flight.departureTime && flight.arrivalTime) {
        summary += `\nDeparting: ${flight.departureTime}, Arriving: ${flight.arrivalTime}`;
      }

      summary += "\n\n";
    });
  }

  // Add hotel information
  if (travelInfo.hotels && travelInfo.hotels.length > 0) {
    summary += "🏨 *Hotels*\n";
    travelInfo.hotels.forEach((hotel, index) => {
      if (hotel.name) {
        summary += `${hotel.name}\n`;
      }

      if (hotel.checkIn && hotel.checkOut) {
        summary += `Check-in: ${hotel.checkIn}, Check-out: ${hotel.checkOut}\n`;
      }

      summary += "\n";
    });
  }

  // Add car rental information
  if (travelInfo.carRentals && travelInfo.carRentals.length > 0) {
    summary += "🚗 *Car Rentals*\n";
    travelInfo.carRentals.forEach((rental, index) => {
      if (rental.company) {
        summary += `${rental.company}\n`;
      }

      if (rental.pickUp && rental.dropOff) {
        summary += `Pick-up: ${rental.pickUp}, Drop-off: ${rental.dropOff}\n`;
      }

      summary += "\n";
    });
  }

  // Add confirmation numbers
  if (travelInfo.confirmationNumbers && travelInfo.confirmationNumbers.length > 0) {
    summary += "📋 *Confirmation Numbers*\n";
    travelInfo.confirmationNumbers.forEach(number => {
      summary += `${number}\n`;
    });
    summary += "\n";
  }

  // If nothing was found
  if ((!travelInfo.flights || travelInfo.flights.length === 0) &&
      (!travelInfo.hotels || travelInfo.hotels.length === 0) &&
      (!travelInfo.carRentals || travelInfo.carRentals.length === 0)) {
    summary = "I couldn't find any specific travel information in that image. Please make sure the image contains clear travel itinerary details like flight information, hotel bookings, or car rentals.";
  }

  return summary;
}

// Main function to handle incoming requests from Twilio
addEventListener('fetch', event => {
  // Call the API key check at startup
  checkUnstructuredApiKey();
  // Test API connection in the background
  event.waitUntil(testUnstructuredApi());

  // Handle the request as normal
  event.respondWith(handleRequest(event.request, event));
});

async function handleRequest(request, event) {
  console.log(`Request received from ${request.headers.get('cf-connecting-ip') || 'unknown IP'}`);

  // Check for correct method
  if (request.method !== 'POST') {
    console.log('Received non-POST request:', request.method);
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    console.log('Processing incoming webhook...');

    // Log the webhook data
    const webhookData = await logTwilioWebhook(request);
    const { from, body, numMedia, mediaItems } = webhookData;

    // Determine the response based on the message
    let responseMessage;

    if (numMedia > 0 && mediaItems.length > 0) {
      // Let the user know we're processing their image
      responseMessage = "I'm analyzing your travel document. This may take a moment...";

      // Return immediate acknowledgment to not keep WhatsApp waiting
      const initialResponse = new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>${escapeXml(responseMessage)}</Message>
        </Response>`,
        {
          headers: {
            'Content-Type': 'text/xml'
          }
        }
      );

      // Process image in the background
      event.waitUntil((async () => {
        try {
          // Process the first image
          const mediaItem = mediaItems[0];
          console.log(`Processing media: ${mediaItem.url}`);

          // Extract travel information from the image
          const travelInfo = await processImageFromUrl(mediaItem.url, mediaItem.contentType);
          console.log('Extracted travel info:', JSON.stringify(travelInfo, null, 2));

          // Generate a user-friendly summary
          const summary = generateTravelSummary(travelInfo);

          // Send the summary as a follow-up message using Twilio API
          await sendFollowUpMessage(from, summary);
        } catch (error) {
          console.error('Error in background processing:', error);
          await sendFollowUpMessage(from, "Sorry, I had trouble processing your image. Please try again with a clearer image of your travel document.");
        }
      })());

      return initialResponse;
    } else {
      // Process text command
      responseMessage = processTextCommand(body);

      // Return TwiML response directly to Twilio
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>${escapeXml(responseMessage)}</Message>
        </Response>`,
        {
          headers: {
            'Content-Type': 'text/xml'
          }
        }
      );
    }
  } catch (error) {
    console.error('Error handling request:', {
      message: error.message,
      stack: error.stack || 'No stack trace'
    });

    // Still return a valid TwiML response even on error
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>Sorry, I encountered an error processing your request.</Message>
      </Response>`,
      {
        status: 500,
        headers: {
          'Content-Type': 'text/xml'
        }
      }
    );
  }
}

// Function to send a follow-up message after processing is complete
async function sendFollowUpMessage(to, message) {
  try {
    const accountSid = TWILIO_ACCOUNT_SID;
    const authToken = TWILIO_AUTH_TOKEN;
    const fromNumber = TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.error('Missing Twilio credentials for follow-up message');
      return;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    // For WhatsApp, we need to use the whatsapp: prefix
    const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const formattedFrom = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;

    const formData = new FormData();
    formData.append('To', formattedTo);
    formData.append('From', formattedFrom);
    formData.append('Body', message);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`
      },
      body: formData
    });

    const responseData = await response.text();

    if (!response.ok) {
      console.error(`Error sending follow-up message: ${response.status}`, responseData);
    } else {
      console.log('Follow-up message sent successfully');
    }
  } catch (error) {
    console.error('Error sending follow-up message:', error);
  }
}

// Helper function to escape XML special characters to prevent injection
function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}
