import * as admin from "firebase-admin";

admin.initializeApp();

const client = new admin.firestore.v1.FirestoreAdminClient();

export default async () => {
  const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || "";
  const databaseName = client.databasePath(projectId, "(default)");
  const bucket = "gs://santashop-backups";

  return client
      .exportDocuments({
        name: databaseName,
        outputUriPrefix: bucket,
        // Leave collectionIds empty to export all collections
        // or set to a list of collection IDs to export,
        // collectionIds: ['users', 'posts']
        collectionIds: [],
      })
      .then((responses: any) => {
        const response = responses[0];
        console.log(`Operation Name: ${response.name}`);
      })
      .catch((err: any) => {
        console.error(`Error: ${projectId}, ${databaseName}: ${err}`);
        throw new Error("Export operation failed");
      });
};
