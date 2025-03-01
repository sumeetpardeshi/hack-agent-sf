// Function to process images using Unstructured API
async function processImageWithUnstructured(imageData, imageType) {
  try {
    // Convert base64 image data to blob
    const byteCharacters = atob(imageData);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
      const slice = byteCharacters.slice(offset, offset + 1024);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    const blob = new Blob(byteArrays, { type: imageType });
    
    // Create FormData for multipart/form-data request
    const formData = new FormData();
    formData.append('files', blob, 'travel_document.jpg');
    formData.append('strategy', 'hi_res');
    
    // Make request to Unstructured API
    const response = await fetch('https://api.unstructured.io/general/v0/general', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'unstructured-api-key': UNSTRUCTURED_API_KEY, // This should be stored in environment variables
      },
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Unstructured API error: ${response.status} ${await response.text()}`);
    }
    
    const data = await response.json();
    
    // Process the extracted data
    return processExtractedData(data);
  } catch (error) {
    console.error('Error processing image with Unstructured:', error);
    throw error;
  }
}

// Function to process extracted data from Unstructured API
function processExtractedData(extractedData) {
  // Initialize object to store structured travel information
  const travelInfo = {
    flights: [],
    hotels: [],
    carRentals: [],
    dates: [],
    locations: [],
    confirmationNumbers: [],
    raw: extractedData,
  };
  
  // Process each element returned by Unstructured
  for (const element of extractedData) {
    // Extract text content
    const text = element.text;
    
    // Look for flight information
    if (text.match(/flight|airline|departing|arriving|terminal|gate|boarding/i)) {
      identifyFlightInfo(text, travelInfo);
    }
    
    // Look for hotel information
    if (text.match(/hotel|reservation|check-in|check-out|room|accommodation/i)) {
      identifyHotelInfo(text, travelInfo);
    }
    
    // Look for car rental information
    if (text.match(/car rental|vehicle|pick-up|drop-off/i)) {
      identifyCarRentalInfo(text, travelInfo);
    }
    
    // Look for dates
    const dateMatches = text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4}|[A-Z][a-z]{2}\s\d{1,2},\s\d{4}/g);
    if (dateMatches) {
      travelInfo.dates = [...travelInfo.dates, ...dateMatches];
    }
    
    // Look for confirmation numbers
    const confirmationMatches = text.match(/confirmation[:\s]+([A-Z0-9]+)/i);
    if (confirmationMatches && confirmationMatches[1]) {
      travelInfo.confirmationNumbers.push(confirmationMatches[1]);
    }
  }
  
  // Remove duplicates
  travelInfo.dates = [...new Set(travelInfo.dates)];
  travelInfo.confirmationNumbers = [...new Set(travelInfo.confirmationNumbers)];
  
  return travelInfo;
}

// Helper function to identify flight information
function identifyFlightInfo(text, travelInfo) {
  const flightInfo = {};
  
  // Look for flight number
  const flightNumberMatch = text.match(/([A-Z]{2,3})\s?(\d{1,4})/);
  if (flightNumberMatch) {
    flightInfo.flightNumber = flightNumberMatch[0];
  }
  
  // Look for departure and arrival locations
  const routeMatch = text.match(/([A-Z]{3})\s+to\s+([A-Z]{3})/);
  if (routeMatch) {
    flightInfo.departure = routeMatch[1];
    flightInfo.arrival = routeMatch[2];
    travelInfo.locations.push(routeMatch[1], routeMatch[2]);
  }
  
  // Look for departure and arrival times
  const timeMatch = text.match(/(\d{1,2}:\d{2})\s*(AM|PM)?/gi);
  if (timeMatch && timeMatch.length >= 2) {
    flightInfo.departureTime = timeMatch[0];
    flightInfo.arrivalTime = timeMatch[1];
  }
  
  // Add to flights array if we found useful information
  if (Object.keys(flightInfo).length > 0) {
    flightInfo.rawText = text;
    travelInfo.flights.push(flightInfo);
  }
}

// Helper function to identify hotel information
function identifyHotelInfo(text, travelInfo) {
  const hotelInfo = {};
  
  // Look for hotel name
  const hotelNameMatch = text.match(/(?:hotel|inn|suites|resort):\s*([^,\n]+)/i);
  if (hotelNameMatch) {
    hotelInfo.name = hotelNameMatch[1].trim();
  }
  
  // Look for check-in and check-out dates
  const checkInMatch = text.match(/check-in:?\s*([^\n,]+)/i);
  if (checkInMatch) {
    hotelInfo.checkIn = checkInMatch[1].trim();
  }
  
  const checkOutMatch = text.match(/check-out:?\s*([^\n,]+)/i);
  if (checkOutMatch) {
    hotelInfo.checkOut = checkOutMatch[1].trim();
  }
  
  // Add to hotels array if we found useful information
  if (Object.keys(hotelInfo).length > 0) {
    hotelInfo.rawText = text;
    travelInfo.hotels.push(hotelInfo);
  }
}

// Helper function to identify car rental information
function identifyCarRentalInfo(text, travelInfo) {
  const carRentalInfo = {};
  
  // Look for rental company
  const companyMatch = text.match(/(?:rental|car):\s*([^,\n]+)/i);
  if (companyMatch) {
    carRentalInfo.company = companyMatch[1].trim();
  }
  
  // Look for pick-up and drop-off dates
  const pickUpMatch = text.match(/pick-up:?\s*([^\n,]+)/i);
  if (pickUpMatch) {
    carRentalInfo.pickUp = pickUpMatch[1].trim();
  }
  
  const dropOffMatch = text.match(/drop-off:?\s*([^\n,]+)/i);
  if (dropOffMatch) {
    carRentalInfo.dropOff = dropOffMatch[1].trim();
  }
  
  // Add to carRentals array if we found useful information
  if (Object.keys(carRentalInfo).length > 0) {
    carRentalInfo.rawText = text;
    travelInfo.carRentals.push(carRentalInfo);
  }
}

// Export functions for use in other modules
export {
  processImageWithUnstructured,
  processExtractedData
};
