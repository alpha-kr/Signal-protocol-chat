// Your web app's Firebase configuration
 


/**
 * Dummy signal server connector.
 * 
 * In a real application this component would connect to your signal
 * server for storing and fetching user public keys over HTTP.
 */
window.addEventListener('close',()=>{
    firebase.database().ref('preKeyBundleUsers/' + user).update({
        status:0,});

});
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
            status:1,
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
    async getPreKeyBundle(userId) {
        let data;
        await firebase.database().ref('preKeyBundleUsers/' + userId).once('value').then(function (snapshot) {
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
     // se supone que este es el usuario en el pc
    //var user2 = 'alice' // para propositos de prueba SE DEBE BORRAR Y TODO LO QUE SEA USER2

    dummySignalServer = new SignalServerStore();

    signalProtocolManagerUser = new SignalProtocolManager(user[0], dummySignalServer);
    //signalProtocolManagerUser2 = new SignalProtocolManager(user2, dummySignalServer);

    await Promise.all([
        signalProtocolManagerUser.initializeAsync(),
        //signalProtocolManagerUser2.initializeAsync()
    ]);

 

}

async function sendMessage(receiver) {
    
 
    const messagePT = document.getElementById('msg').value;
    let mensajes=document.querySelector("div.msg_history");
   
    let tumensaje=`<div class="outgoing_msg">
    <div class="sent_msg">
    <p>${messagePT}</p>
    <span class="time_date"> 11:01 AM    |    June 9</span> </div>
  </div>`
  mensajes.innerHTML+=tumensaje;
    const messageEnc = await signalProtocolManagerUser.encryptMessageAsync(user[0]=='alice'?'bob':'alice', messagePT);
    firebase.database().ref('chat/msg0').push({
        sender: user[0],
        receiver: user[0]=='alice'?'bob':'alice',
        msg: messageEnc
    });
     
    
}