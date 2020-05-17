const db=firebase.database();
var alice=-1;
var bob=-1;
 
var usuarios=db.ref('preKeyBundleUsers/alice/status')
usuarios.once('value').then((s)=>{
  alice=s.val();
  
  firebase.database().ref('preKeyBundleUsers/bob/status').once('value').then(( e)=>{
   
  bob=e.val();
  console.log(alice," ",bob)
  if (alice ==1 && bob==1 ) {
    alert("session ocupada"); 
    document.write("alice y bob ya estan hablando")
    
}  else{
  
  while(  !(user=prompt("Escriba usuario Opciones alice o bob").match('alice|bob'))  ){
   
      alert(user[0]+"debes escribir alice o bob literalmente")
    
    
  }
  
  runDemo();
db.ref('preKeyBundleUsers/' + user[0]).update({
  status:1});
let h5=document.getElementById("contacto").innerText=user[0]=='alice'?'bob':'alice';

   


}
});

   

});
firebase.database().ref('chat').remove()


    
firebase.database().ref('chat/msg0').on('child_added', async function(snapshot) {
     
    if(snapshot.val().receiver == user[0]){
        
       console.log(user[0]);
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
 
