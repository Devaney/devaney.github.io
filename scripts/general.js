//if ('serviceWorker' in navigator) {
//  navigator.serviceWorker
//    .register('./sw.js', {scope: './' })
//    .then(function(reg) {
//    if(reg.installing) {
//      console.log('Service worker installing');
//    } else if(reg.waiting) {
//      console.log('Service worker installed');
//    } else if(reg.active) {
//      console.log('Service worker active');
//    }
//
//  }).catch(function(error) {
//    // registration failed
//    console.log('Registration failed with ' + error);
//  });
//}

$('#menu-btn-js, nav a').click(function(){
  var w = $(window).width();
  $('#menu-btn-js').text($(this).text() == 'Menu' ? 'Close' : 'Menu');
  if ($("nav").hasClass('hidden') && w < 699) {
      $("nav").removeClass('hidden').addClass('active').animate({left:'0'}, 250);
  } else if($("nav").hasClass('active') && w < 699) {
      $("nav").animate({left:'-280'}, 250, function(){
        $("nav").removeClass('active').addClass('hidden')
    });
  }
});

$(function() {

    var allPanels = $('.accordion > dd').hide();

    $('.accordion > dt > a').click(function() {
        $target =  $(this).parent().next();

        if(!$target.hasClass('active')){
            allPanels.removeClass('active').slideUp();
            $target.addClass('active').slideDown();
        }
        return false;
    });

    $('.accordion a.closeme').click(function() {
        allPanels.removeClass('active').slideUp();
        return false;
    });

});
