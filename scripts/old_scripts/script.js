
//function loadExternalContent() {
//  jQuery('#content-container').load("http://www.pocketworldcupschedule.info/", function () {
//    alert('External page loaded!');
//  });
//}

//$(function(){
//var contentURI= 'http://pocketworldcupschedule.info/';
//$('#response').load('grab.php?url='+ contentURI);
//});

$.getJSON('http://whateverorigin.org/get?url=' + 
          encodeURIComponent('http://pocketworldcupschedule.info/') + '&callback=?',
          function(data){
            $("#response").html(data.contents);
});


//$( document ).ready(function() {
//        console.log( "document loaded" );

//var contentURI= 'http://www.pocketworldcupschedule.info/';
//$('#response').load('grab.php?url='+ contentURI);


//        $("#testDiv").load("http://www.pocketworldcupschedule.info/");
//    });
 
 //   $( window ).load(function() {
 //       console.log( "window loaded" );
//             console.log( " I IS ready1111111" );
//  $( "#sweestakeiframe" ).contents().find( "a" ).css( "background-color", "#BADA55" ).replace('ITALY','Liam');
//      console.log( " I IS ready2222222" );
//  $('#sweestakeiframe').contents().find('span').replace('ITALY','Liam');
//     console.log( " I IS ready3333333" );

 //   });

