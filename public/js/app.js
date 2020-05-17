const db=firebase.database();
var user;
var dummySignalServer  ;

var signalProtocolManagerUser;

var usuarios=db.ref('preKeyBundleUsers');
usuarios.on('value',(s)=>{
    if (s.val().alice.status==1 && s.val().bob.status==1) {
        alert("session ocupada");
        
    } 


     

});

while(  !(user=prompt("Escriba usuario Opciones alice o bob").match('alice|bob'))){
     
    }
    let h5=document.getElementById("contacto").innerText=user[0]=='alice'?'bob':'alice';
   db.ref('preKeyBundleUsers/' + user[0]).update({
        status:1});
    runDemo();
    var shit;
firebase.database().ref('chat/msg0').on('child_added', async function(snapshot) {
     
    if(snapshot.val().receiver == user[0]){
        
       
        const msgEC = {
            body: snapshot.val().msg.body,
            registrationId: snapshot.val().msg.registrationId,
            type: snapshot.val().msg.type
        }
        const decryptedMessage = await signalProtocolManagerUser.decryptMessageAsync(user, msgEC);  // CAMBIAR POR EL USUARIO QUE DEBE ESTAR EN EL PC user
        console.log(decryptedMessage);
        let mensajes=document.querySelector("div.msg_history");
        mensajes.innerHTML+=` <div class="incoming_msg">
        <div class="incoming_msg_img"> <img src="https://ptetutorials.com/images/user-profile.png" alt="sunil"> </div>
        <div class="received_msg">
        <div class="received_withd_msg">
          <p>${decryptedMessage}</p>
          <span class="time_date"> 11:01 AM    |    June 9</span></div>
        </div>
      </div>`
    }else{
         
    


    }
  });
 
