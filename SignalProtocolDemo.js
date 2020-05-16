// Your web app's Firebase configuration
var firebaseConfig = {
    apiKey: "AIzaSyCFOoLwpSfr4oA2XQ_zDYbVoGECKJZgSrY",
    authDomain: "signalchat-8d354.firebaseapp.com",
    databaseURL: "https://signalchat-8d354.firebaseio.com",
    projectId: "signalchat-8d354",
    storageBucket: "signalchat-8d354.appspot.com",
    messagingSenderId: "299458260385",
    appId: "1:299458260385:web:e7ab70aa449af995ccefe0",
    measurementId: "G-E7DF4PP803"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
firebase.analytics();
var database = firebase.database();


/**
 * Dummy signal server connector.
 * 
 * In a real application this component would connect to your signal
 * server for storing and fetching user public keys over HTTP.
 */
class SignalServerStore {
    constructor() {
        this.store = {};
    }

    /**
     * When a user logs on they should generate their keys and then register them with the server.
     * 
     * @param userId The user ID.
     * @param preKeyBundle The user's generated pre-key bundle.
     */
    registerNewPreKeyBundle(userId, preKeyBundle) {
        this.store[userId] = preKeyBundle;
        firebase.database().ref('preKeyBundleUsers/' + userId).set({
            identityKey: util.toString(this.store[userId].identityKey),
            registrationId: this.store[userId].registrationId,
            preKey: {
                keyId: this.store[userId].preKey.keyId,
                publicKey: util.toString(this.store[userId].preKey.publicKey)
            },
            signedPreKey: {
                keyId: this.store[userId].signedPreKey.keyId,
                publicKey: util.toString(this.store[userId].signedPreKey.publicKey),
                signature: util.toString(this.store[userId].signedPreKey.signature)
            }
        });
    }

    /**
     * Gets the pre-key bundle for the given user ID.
     * If you want to start a conversation with a user, you need to fetch their pre-key bundle first.
     * 
     * @param userId The ID of the user.
     */
    async getPreKeyBundle(userId)  {
        let data;
        await firebase.database().ref('preKeyBundleUsers/' + userId).once('value').then(function (snapshot) {
            console.log(snapshot.val());
            console.log(util.toArrayBuffer(snapshot.val().identityKey));
            data = {
                identityKey: util.toArrayBuffer(snapshot.val().identityKey),
                registrationId: snapshot.val().registrationId,
                preKey: {
                    keyId: snapshot.val().preKey.keyId,
                    publicKey: util.toArrayBuffer(snapshot.val().preKey.publicKey)
                },
                signedPreKey: {
                    keyId: snapshot.val().signedPreKey.keyId,
                    publicKey: util.toArrayBuffer(snapshot.val().signedPreKey.publicKey),
                    signature: util.toArrayBuffer(snapshot.val().signedPreKey.signature)
                }
            }
        });
        console.log('hola')
        return data;
        //return this.store[userId];
    }
}

/**
 * A signal protocol manager.
 */
class SignalProtocolManager {
    constructor(userId, signalServerStore) {
        this.userId = userId;
        this.store = new SignalProtocolStore();
        this.signalServerStore = signalServerStore;
    }

    /**
     * Initialize the manager when the user logs on.
     */
    async initializeAsync() {
        await this._generateIdentityAsync();

        var preKeyBundle = await this._generatePreKeyBundleAsync(123, 456);

        this.signalServerStore.registerNewPreKeyBundle(this.userId, preKeyBundle);
    }

    /**
     * Encrypt a message for a given user.
     * 
     * @param remoteUserId The recipient user ID.
     * @param message The message to send.
     */
    async encryptMessageAsync(remoteUserId, message) {
        var sessionCipher = this.store.loadSessionCipher(remoteUserId);

        if (sessionCipher == null) {
            var address = new libsignal.SignalProtocolAddress(remoteUserId, 123);
            var sessionBuilder = new libsignal.SessionBuilder(this.store, address);

            var remoteUserPreKey = await this.signalServerStore.getPreKeyBundle(remoteUserId);
            await sessionBuilder.processPreKey(remoteUserPreKey);

            var sessionCipher = new libsignal.SessionCipher(this.store, address);
            this.store.storeSessionCipher(remoteUserId, sessionCipher);
        }

        var cipherText = await sessionCipher.encrypt(util.toArrayBuffer(message));

        return cipherText;
    }

    /**
     * Decrypts a message from a given user.
     * 
     * @param remoteUserId The user ID of the message sender.
     * @param cipherText The encrypted message bundle. (This includes the encrypted message itself and accompanying metadata)
     * @returns The decrypted message string.
     */
    async decryptMessageAsync(remoteUserId, cipherText) {
        var sessionCipher = this.store.loadSessionCipher(remoteUserId);

        if (sessionCipher == null) {
            var address = new libsignal.SignalProtocolAddress(remoteUserId, 123);
            var sessionCipher = new libsignal.SessionCipher(this.store, address);
            this.store.storeSessionCipher(remoteUserId, sessionCipher);
        }

        var messageHasEmbeddedPreKeyBundle = cipherText.type == 3;

        if (messageHasEmbeddedPreKeyBundle) {
            var decryptedMessage = await sessionCipher.decryptPreKeyWhisperMessage(cipherText.body, 'binary');
            return util.toString(decryptedMessage);
        } else {
            var decryptedMessage = await sessionCipher.decryptWhisperMessage(cipherText.body, 'binary');
            return util.toString(decryptedMessage);
        }
    }

    /**
     * Generates a new identity for the local user.
     */
    async _generateIdentityAsync() {
        var results = await Promise.all([
            libsignal.KeyHelper.generateIdentityKeyPair(),
            libsignal.KeyHelper.generateRegistrationId(),
        ]);

        this.store.put('identityKey', results[0]);
        this.store.put('registrationId', results[1]);
    }

    /**
     * Generates a new pre-key bundle for the local user.
     * 
     * @param preKeyId An ID for the pre-key.
     * @param signedPreKeyId An ID for the signed pre-key.
     * @returns A pre-key bundle.
     */
    async _generatePreKeyBundleAsync(preKeyId, signedPreKeyId) {
        var result = await Promise.all([
            this.store.getIdentityKeyPair(),
            this.store.getLocalRegistrationId()
        ]);

        let identity = result[0];
        let registrationId = result[1];

        var keys = await Promise.all([
            libsignal.KeyHelper.generatePreKey(preKeyId),
            libsignal.KeyHelper.generateSignedPreKey(identity, signedPreKeyId),
        ]);

        let preKey = keys[0]
        let signedPreKey = keys[1];

        this.store.storePreKey(preKeyId, preKey.keyPair);
        this.store.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair);

        return {
            identityKey: identity.pubKey,
            registrationId: registrationId,
            preKey: {
                keyId: preKeyId,
                publicKey: preKey.keyPair.pubKey
            },
            signedPreKey: {
                keyId: signedPreKeyId,
                publicKey: signedPreKey.keyPair.pubKey,
                signature: signedPreKey.signature
            }
        };
    }
}

/**
 * Runs the Signal Protocol demo.
 */
async function runDemo() {
    var user = "bob";
    var user2 = 'alice'
    //var user2 = "Alice";

    dummySignalServer = new SignalServerStore();

    signalProtocolManagerUser = new SignalProtocolManager(user, dummySignalServer);
    let signalProtocolManagerUser2 = new SignalProtocolManager(user2, dummySignalServer);

    await Promise.all([
        signalProtocolManagerUser.initializeAsync(),
        signalProtocolManagerUser2.initializeAsync()
    ]);

    /**
     * Let's send an encrypted message from user1 to user2 and then from user2 back to user1.
     */
    //var message = "Hello User 2 !";
    //var encryptedMessage = await signalProtocolManagerUser1.encryptMessageAsync(user2, message);
    //alert("User1: Sending message to User2:\n\nMessage = " + message);

    //var decryptedMessage = await signalProtocolManagerUser2.decryptMessageAsync(user1, encryptedMessage);
    //alert("User2: Message received from User1\n\nEncrypted Message = " + encryptedMessage.body + "\n\nDecrypted Message = " + decryptedMessage);

    //var message2 = "What is up user 1?";
    //var encryptedMessage2 = await signalProtocolManagerUser2.encryptMessageAsync(user1, message2);
    //alert("User2: Sending message to User1:\n\nMessage = " + message2);

    //var decryptedMessage2 = await signalProtocolManagerUser1.decryptMessageAsync(user2, encryptedMessage2);
    //alert("User1: Message received from User2\n\nEncrypted Message = " + encryptedMessage2.body + "\n\nDecrypted Message = " + decryptedMessage2);
}

async function sendMessage(receiver) {
    const messagePT =  document.getElementById('msg').value;
    const messageEnc = await signalProtocolManagerUser.encryptMessageAsync(receiver, messagePT);
    console.log(messageEnc);
    firebase.database().ref('chat/' + 'msg0').set({
        sender: 'bob',
        receiver: 'alice',
        msg: messageEnc
    });
    
}