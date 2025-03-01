// AstraDB vector database integration
import { createClient } from "@astrajs/collections";
import { Configuration, OpenAIApi } from "openai";

// Initialize OpenAI client (for generating embeddings)
const configuration = new Configuration({
  apiKey: OPENAI_API_KEY, // Should be stored in environment variables
});
const openai = new OpenAIApi(configuration);

// Initialize AstraDB client
let astraClient = null;
let travelCollection = null;

/**
 * Initialize AstraDB client and collection
 */
async function initializeAstraDb() {
  if (!astraClient) {
    astraClient = await createClient({
      astraDatabaseId: ASTRA_DB_ID,
      astraDatabaseRegion: ASTRA_DB_REGION,
      applicationToken: ASTRA_DB_APPLICATION_TOKEN,
    });
    
    // Create or get the travel collection
    travelCollection = astraClient.namespace(ASTRA_DB_KEYSPACE).collection("travel_documents");
    
    console.log("AstraDB client initialized");
  }
  
  return { astraClient, travelCollection };
}

/**
 * Generate embedding for the provided text using OpenAI API
 * @param {string} text - The text to generate an embedding for
 * @returns {Promise<Array<number>>} The embedding vector
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.createEmbedding({
      model: "text-embedding-ada-002",
      input: text,
    });
    
    return response.data.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Store travel information and document in AstraDB
 * @param {string} phoneNumber - User's phone number as unique identifier
 * @param {Object} travelInfo - Structured travel information
 * @param {string} rawDocumentText - Raw text of the document for embedding
 * @returns {Promise<Object>} Result of the database operation
 */
async function storeTravelDocument(phoneNumber, travelInfo, rawDocumentText) {
  try {
    const { travelCollection } = await initializeAstraDb();
    
    // Generate embedding for the document text
    const embedding = await generateEmbedding(rawDocumentText);
    
    // Create a document with metadata and embedding
    const document = {
      phoneNumber,
      travelInfo,
      rawDocumentText,
      embedding,
      createdAt: new Date().toISOString(),
      documentType: detectDocumentType(travelInfo),
    };
    
    // Store in AstraDB
    const result = await travelCollection.create(document);
    
    console.log(`Stored travel document for user ${phoneNumber}`);
    return result;
  } catch (error) {
    console.error("Error storing travel document:", error);
    throw error;
  }
}

/**
 * Retrieve travel information for a user
 * @param {string} phoneNumber - User's phone number
 * @returns {Promise<Array<Object>>} Travel documents for the user
 */
async function getUserTravelDocuments(phoneNumber) {
  try {
    const { travelCollection } = await initializeAstraDb();
    
    // Query for all documents belonging to the user
    const documents = await travelCollection.find({
      phoneNumber: { $eq: phoneNumber },
    });
    
    return documents;
  } catch (error) {
    console.error("Error retrieving user travel documents:", error);
    throw error;
  }
}

/**
 * Perform semantic search on user's travel documents
 * @param {string} phoneNumber - User's phone number
 * @param {string} query - The search query
 * @returns {Promise<Array<Object>>} Matching travel documents
 */
async function searchUserTravelDocuments(phoneNumber, query) {
  try {
    const { travelCollection } = await initializeAstraDb();
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Perform vector search
    const searchResults = await travelCollection.find(
      { phoneNumber: { $eq: phoneNumber } },
      {
        sort: {
          $vector: {
            vector: queryEmbedding,
            field: "embedding",
            limit: 5,
          }
        }
      }
    );
    
    return searchResults;
  } catch (error) {
    console.error("Error searching travel documents:", error);
    throw error;
  }
}

/**
 * Detect the type of travel document based on the extracted information
 * @param {Object} travelInfo - The structured travel information
 * @returns {string} The detected document type
 */
function detectDocumentType(travelInfo) {
  if (travelInfo.flights && travelInfo.flights.length > 0) {
    return "FLIGHT_ITINERARY";
  } else if (travelInfo.hotels && travelInfo.hotels.length > 0) {
    return "HOTEL_RESERVATION";
  } else if (travelInfo.carRentals && travelInfo.carRentals.length > 0) {
    return "CAR_RENTAL";
  } else {
    return "UNKNOWN";
  }
}

export {
  initializeAstraDb,
  storeTravelDocument,
  getUserTravelDocuments,
  searchUserTravelDocuments
};
