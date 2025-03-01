// Testing module for Twil-Flare components
// This allows testing the image processing and AstraDB storage without Twilio

// Import dependencies
// import { processImageWithUnstructured } from './unstructured';
// import { initializeAstraDb, storeTravelDocument, getUserTravelDocuments, searchUserTravelDocuments } from './astradb';

// Function to simulate processing an image file
async function testImageProcessing(imagePath) {
  try {
    console.log(`Testing image processing with file: ${imagePath}`);

    // Read the image file
    const imageBuffer = await Deno.readFile(imagePath);
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

    // Detect content type based on file extension
    const contentType = getContentTypeFromPath(imagePath);

    console.log(`File loaded and converted to base64, content type: ${contentType}`);

    // Process with Unstructured API
    const travelInfo = await processImageWithUnstructured(base64Image, contentType);

    console.log('Unstructured API processing result:');
    console.log(JSON.stringify(travelInfo, null, 2));

    return travelInfo;
  } catch (error) {
    console.error('Error in test image processing:', error);
    throw error;
  }
}

// Function to test AstraDB storage
async function testAstraDbStorage(phoneNumber, travelInfo) {
  try {
    console.log(`Testing AstraDB storage for phone number: ${phoneNumber}`);

    // Create raw text for embedding
    const rawText = createRawTextFromTravelInfo(travelInfo);

    // Store in AstraDB
    const result = await storeTravelDocument(phoneNumber, travelInfo, rawText);

    console.log('AstraDB storage result:');
    console.log(JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error('Error in test AstraDB storage:', error);
    throw error;
  }
}

// Function to test retrieving documents
async function testRetrieveDocuments(phoneNumber) {
  try {
    console.log(`Testing document retrieval for phone number: ${phoneNumber}`);

    // Get documents from AstraDB
    const documents = await getUserTravelDocuments(phoneNumber);

    console.log(`Retrieved ${documents.length} documents:`);
    console.log(JSON.stringify(documents, null, 2));

    return documents;
  } catch (error) {
    console.error('Error in test document retrieval:', error);
    throw error;
  }
}

// Function to test semantic search
async function testSemanticSearch(phoneNumber, query) {
  try {
    console.log(`Testing semantic search for phone number: ${phoneNumber} with query: "${query}"`);

    // Search documents
    const searchResults = await searchUserTravelDocuments(phoneNumber, query);

    console.log(`Search returned ${searchResults.length} results:`);
    console.log(JSON.stringify(searchResults, null, 2));

    return searchResults;
  } catch (error) {
    console.error('Error in test semantic search:', error);
    throw error;
  }
}

// Function to run all tests with a sample image
async function runAllTests(imagePath, phoneNumber, searchQuery) {
  try {
    // Step 1: Process image
    console.log('=== STEP 1: Processing Image ===');
    const travelInfo = await testImageProcessing(imagePath);

    // Step 2: Store in AstraDB
    console.log('\n=== STEP 2: Storing in AstraDB ===');
    await testAstraDbStorage(phoneNumber, travelInfo);

    // Step 3: Retrieve documents
    console.log('\n=== STEP 3: Retrieving Documents ===');
    await testRetrieveDocuments(phoneNumber);

    // Step 4: Test semantic search
    console.log('\n=== STEP 4: Testing Semantic Search ===');
    await testSemanticSearch(phoneNumber, searchQuery);

    console.log('\n=== All tests completed successfully! ===');
  } catch (error) {
    console.error('Error during test suite execution:', error);
  }
}

// Helper function to create raw text from travel info for embedding
function createRawTextFromTravelInfo(travelInfo) {
  let rawText = '';

  // Add flight information
  if (travelInfo.flights && travelInfo.flights.length > 0) {
    travelInfo.flights.forEach(flight => {
      rawText += `Flight: ${flight.flightNumber || 'Unknown'}. `;
      if (flight.departure && flight.arrival) {
        rawText += `From ${flight.departure} to ${flight.arrival}. `;
      }
      if (flight.departureTime && flight.arrivalTime) {
        rawText += `Departing at ${flight.departureTime}, arriving at ${flight.arrivalTime}. `;
      }
    });
  }

  // Add hotel information
  if (travelInfo.hotels && travelInfo.hotels.length > 0) {
    travelInfo.hotels.forEach(hotel => {
      rawText += `Hotel: ${hotel.name || 'Unknown'}. `;
      if (hotel.checkIn) {
        rawText += `Check-in: ${hotel.checkIn}. `;
      }
      if (hotel.checkOut) {
        rawText += `Check-out: ${hotel.checkOut}. `;
      }
    });
  }

  // Add car rental information
  if (travelInfo.carRentals && travelInfo.carRentals.length > 0) {
    travelInfo.carRentals.forEach(rental => {
      rawText += `Car Rental: ${rental.company || 'Unknown'}. `;
      if (rental.pickUp) {
        rawText += `Pick-up: ${rental.pickUp}. `;
      }
      if (rental.dropOff) {
        rawText += `Drop-off: ${rental.dropOff}. `;
      }
    });
  }

  // Add dates
  if (travelInfo.dates && travelInfo.dates.length > 0) {
    rawText += `Dates: ${travelInfo.dates.join(', ')}. `;
  }

  // Add confirmation numbers
  if (travelInfo.confirmationNumbers && travelInfo.confirmationNumbers.length > 0) {
    rawText += `Confirmation numbers: ${travelInfo.confirmationNumbers.join(', ')}. `;
  }

  return rawText;
}

// Helper function to determine content type from file path
function getContentTypeFromPath(path) {
  const extension = path.split('.').pop().toLowerCase();

  const contentTypeMap = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'tiff': 'image/tiff',
    'webp': 'image/webp',
    'pdf': 'application/pdf'
  };

  return contentTypeMap[extension] || 'application/octet-stream';
}

// Export functions for use in tests
export {
  testImageProcessing,
  testAstraDbStorage,
  testRetrieveDocuments,
  testSemanticSearch,
  runAllTests
};

// Example usage:
// runAllTests('./sample_itinerary.jpg', '+1234567890', 'When is my flight?');
