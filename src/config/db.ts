import { Db, MongoClient, MongoClientOptions } from "mongodb";

class MongoDB {
  private static client: MongoClient | null = null;
  private static dbName: string;

  /**
   * Inicializa la conexión a MongoDB.
   * @param options - Configuraciones opcionales.
   */
  static async init(options: MongoClientOptions = {}): Promise<void> {
    if (!MongoDB.client) {
      const uri = process.env.MONGODB_URI;
      MongoDB.dbName = process.env.MONGODB_DBNAME || "";

      if (!uri) {
        throw new Error(
          "La URI de MongoDB no está definida en las variables de entorno."
        );
      }

      MongoDB.client = new MongoClient(uri, options);
      await MongoDB.client.connect();
      await MongoDB.setupTTLIndex();
    }
  }

  /**
   * Configura un índice TTL en la colección 'resolvedRequests' para eliminar documentos después de 5 minutos.
   */
  private static async setupTTLIndex(): Promise<void> {
    const db = MongoDB.getDb();
    const collection = db.collection("resolvedRequests");

    // Crear un índice TTL en el campo 'createdAt' con un tiempo de expiración de 300 segundos (5 minutos)
    await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 });
    console.log("Índice TTL configurado para la colección resolvedRequests");
  }

  /**
   * Inicializa la colección con un documento si está vacía.
   */
  static async initializeCollection(): Promise<void> {
    const db = MongoDB.getDb();
    const collection = db.collection("resolvedRequests");

    // Verificar si la colección ya tiene documentos
    const documentCount = await collection.countDocuments();

    // Si la colección está vacía, insertar un documento inicial
    if (documentCount === 0) {
      await collection.insertOne({
        createdAt: new Date(), // Fecha de creación
        description: "Colección de resolvedRequests para la API",
        defaultSetting: true, // Valor predeterminado o de configuración
      });
      console.log(
        "Documento inicial insertado en la colección resolvedRequests."
      );
    } else {
      console.log("La colección resolvedRequests ya contiene documentos.");
    }
  }

  /**
   * Obtiene la instancia del cliente de MongoDB.
   * @returns El cliente de MongoDB.
   */
  static getClient(): MongoClient {
    if (!MongoDB.client) {
      throw new Error(
        "MongoDB no ha sido inicializado. Llama a init() primero."
      );
    }
    return MongoDB.client;
  }

  /**
   * Obtiene una instancia específica de la base de datos.
   * @returns La instancia de la base de datos.
   */
  static getDb(): Db {
    if (!MongoDB.dbName) {
      throw new Error(
        "El nombre de la base de datos no está establecido. Asegúrate de que init() ha sido llamado."
      );
    }
    return MongoDB.getClient().db(MongoDB.dbName);
  }

  /**
   * Cierra la conexión a MongoDB.
   */
  static async close(): Promise<void> {
    if (MongoDB.client) {
      await MongoDB.client.close();
      MongoDB.client = null;
    }
  }
}

export default MongoDB;
