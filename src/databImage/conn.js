import { MongoMemoryServer } from "mongodb-memory-server-core";
import mongoose from "mongoose";

export default async function connect() {
    const mongoServer = await MongoMemoryServer.create(); //Crée et démarre une instance de MongoDB en mémoire sur un port libre
    const mongoUri = mongoServer.getUri(); //Récupère l’URI de connexion

    await mongoose.connect(mongoUri, {dbName: "yulishop"}); //Ouvre la connexion Mongoose vers l’instance en mémoire
    console.log('MongoDB successfully connected to ${mongoUri}');
}