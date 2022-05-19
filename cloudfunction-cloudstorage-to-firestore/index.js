'use strict';

const admin = require('firebase-admin');
const {Storage} = require('@google-cloud/storage');
const split = require('split');

/**
 * Triggered from a Pub/Sub message.
 *
 * @param {!Object} event Event payload.
 * @param {!Object} context Metadata for the event.
 */
exports.loadCloudStorageToFirestore = async(event, context) => {

    const pubSubMessage = event.data ? Buffer.from(event.data, 'base64').toString(): '{}';
    const config = JSON.parse(pubSubMessage);

    console.log(config)

    if (typeof config.projectId != 'undefined') {

        const projectId = config.projectId;
        const bucketName = config.bucketName;
        const bucketPath = config.bucketPath;
        const firestoreCollection = config.firestoreCollection;
        const firestoreKey = config.firestoreKey;

        console.log(`Initiated new import to Firebase: gs://${bucketName}/${bucketPath}`)

        // Init Firebase
        if (admin.apps.length === 0) {
            admin.initializeApp({ projectId: projectId })
        }

        // Init Storage
        const storage = new Storage()
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(bucketPath);

        let keysWritten = 0;

        try {
        
            // TO-DO: Remove old records

            // Read file and send to Redis
            file.createReadStream()
                .on('error', error => reject(error))
                .on('response', (response) => {
                    // connection to GCS opened
                }).pipe(split())
                .on('data',  async record => {
                    if (!record || record === "") return;
                        keysWritten++;

                        const data = JSON.parse(record);
                        const key = data[firestoreKey].replace(/[/]|\./g, '');

                        try {
                            await admin.firestore().collection(firestoreCollection).doc(key).set(data)
                        } catch(e) {
                            console.log(`Error setting document:  ${e}`);
                        }
                })
                .on('end', () => {
                    console.log(`Successfully written ${keysWritten} keys to Firestore.`);
                })
                .on('error', error => reject(error));
        
        } catch(e) {
            console.log(`Error importing ${bucketPath} to Firestore: ${e}`);
        }
    }

};