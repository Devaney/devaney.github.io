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
  $('#menu-btn-js').text($(this).text() == 'Menu' ? 'Close' : 'Menu');
  if ($("nav").hasClass('hidden')) {
      $("nav").removeClass('hidden').addClass('active').animate({left:'0'},350);
  } else {
      $("nav").animate({left:'-280'},350, function(){
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

//$(function(){
//    $("#elastic_grid_demo").elastic_grid({
//      'showAllText' : 'All',
//      'filterEffect': 'popup', // moveup, scaleup, fallperspective, fly, flip, helix , popup
//      'hoverDirection': false,
//      'hoverDelay': 0,
//      'hoverInverse': false,
//      'expandingSpeed': 200,
//      'expandingHeight': 700,
//      'items' :
//[
//{
//    'title'         : 'Login &amp; Registration Redesign',
//    'description'   : 'Updating the registration and login pages was a delicate but vital task.  Redesigning a business critical system is always a challenge.  However with the correct process, tools and attention to detail the Login and Registration update went without error.  We managed to increase the registration completion rate from 26.63%, in the previous quarter, to 70.21%.  This was achieved by removing all distractions from the page, allowing users to focus on the form. We also use the opportunity to bring the page inline with brand styles.',
//    'thumbnail'     : ['images/small/lnr-sm-7.jpg','images/small/lnr-sm-5.jpg','images/small/lnr-sm-3.jpg','images/small/lnr-sm-2.jpg','images/small/lnr-sm-1.jpg','images/small/lnr-sm-4.jpg','images/small/lnr-sm-6.jpg'],
//    'large'         : ['images/large/lnr-lg-7.jpg','images/large/lnr-lg-4.jpg','images/large/lnr-lg-3.jpg','images/large/lnr-lg-2.jpg','images/large/lnr-lg-1.jpg','images/large/lnr-lg-5.jpg','images/large/lnr-lg-6.jpg'],
//    'img_title'     : ['Examples of Liam Devaneys work'],
//    'button_list'   : false,
//    'tags'          : false,
//},
//
//{
//    'title'         : 'Shopping Cart Redesign',
//    'description'   : 'Creating a contemporary  and flat UI styled basket required efforts from an array of departments. Working with the Marketing and Development teams the basket style was updated and increased the basket conversion rate by 47%.',
//    'thumbnail'     : ['images/small/sc-sm-8.jpg','images/small/sc-sm-1.jpg','images/small/sc-sm-2.jpg','images/small/sc-sm-3.jpg','images/small/sc-sm-4.jpg','images/small/sc-sm-5.jpg','images/small/sc-sm-6.jpg','images/small/sc-sm-7.jpg'],
//    'large'         : ['images/large/sc-lg-8.jpg','images/large/sc-lg-1.jpg','images/large/sc-lg-2.jpg','images/large/sc-lg-3.jpg','images/large/sc-lg-4.jpg','images/large/sc-lg-5.jpg','images/large/sc-lg-6.jpg','images/large/sc-lg-7.jpg'],
//    'img_title'     : ['Examples of Liam Devaneys work'],
//    'button_list'   : false,
//    'tags'          : false,
//},
//
//{
//    'title'         : 'Header &amp; Footer Update',
//    'description'   : 'When I was tasked with updating the header and footer of our website and control panel, I was given no direct reason for the update. I decided to focus on two separate segments when picking an achievement that I could focus the redesign on. I wanted to aid firstly our current customer. I focused on giving them a navigation that was easier to scan and breadcrumbs to aid navigation in our complex control panel. For prospect, not yet customers, who are only at the awareness phase of their journey with Memset I focused on building a sub-navigation. The intention here was to show prospect their location as well as other services that they may also be interested in.',
//    'thumbnail'     : ['images/small/hf-sm-2.jpg','images/small/hf-sm-1.jpg','images/small/hf-sm-3.jpg'],
//    'large'         : ['images/large/hf-lg-2.jpg','images/large/hf-lg-1.jpg','images/large/hf-lg-3.jpg'],
//    'img_title'     : ['Examples of Liam Devaneys work'],
//    'button_list'   : false,
//    'tags'          : false,
//},
//
//{
//    'title'         : 'Mobile Version of Memset.com',
//    'description'   : 'As mobile users search, use and purchase more than regular desktops users it was important for Memset to have a responsive site. This needed to be achieved efficiently while maintaining our Quality, Managerial and Security ISO Accreditations. The process took a week of development followed by a further two days of testing. It was done as an addition to the original code, as oppose to creating new mobile first CSS. This was due to the time constraints placed on the project.',
//    'thumbnail'     : ['images/small/mw-sm-7.jpg','images/small/mw-sm-1.jpg','images/small/mw-sm-2.jpg','images/small/mw-sm-3.jpg','images/small/mw-sm-4.jpg','images/small/mw-sm-5.jpg','images/small/mw-sm-6.jpg'],
//    'large'         : ['images/large/mw-lg-7.jpg','images/large/mw-lg-1.jpg','images/large/mw-lg-2.jpg','images/large/mw-lg-3.jpg','images/large/mw-lg-4.jpg','images/large/mw-lg-5.jpg','images/large/mw-lg-6.jpg'],
//    'img_title'     : ['Examples of Liam Devaneys work'],
//    'button_list'   : false,
//    'tags'          : false,
//},
///*
//{
//    'title'         : 'Adding google search to Memset.com',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Support ticketing system',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'New pricing tables',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Faq sections',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Registration section update',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Basket funnel conversion optimisation',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Adding google analytics',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Setting goals in google analytics',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Site wide update full width',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Site wide form consistency update',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Creating pop up banners',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Creating magazine adverts',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Creating 2m x 3m banners',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Online banners',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Email campaigns',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Get feedback survey',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Memset style guide',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Site redesign project management',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Sub navigation promoting browsing of related services',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Pricing table progression',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Analytics tracking of products - events based tracking',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Solutions > industry section',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : '/gov site',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Memset managed services branding',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Business card designs',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Marketing collateral design letterheads, pens, beermats ect',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Axure wireframes',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Axure flow diagrams',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Product Icons',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//
//{
//    'title'         : 'Salesforce web to lead form intergration - apex',
//    'description'   : 'Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here Describe how good you are here',
//    'thumbnail'     : ['images/small/lad-test-small-img.jpg'],
//    'large'         : ['images/large/lad-test-img.png'],
//    'img_title'     : ['jquery elastic grid 1 '],
//    'button_list'   :
//    [
//    { 'title':'View now', 'url' : 'http://liamdevaney.com', 'new_window' : true },
//    ],
//    'tags'          : []
//},
//*/
//]
//});
//});

$(function() {
var form = $('#ajax-contact');
var formMessages = $('#form-messages');

// event listener for the contact form.
$(form).submit(function(event) {
event.preventDefault();


// Serialize the form data.
var formData = $(form).serialize();

// Submit the form using AJAX.
$.ajax({
    type: 'POST',
    url: $(form).attr('action'),
    data: formData
})
.done(function(response) {
// Make sure that the formMessages div has the 'success' class.
$(formMessages).removeClass('alert-danger');
$(formMessages).addClass('alert-success');

// Set the message text.
$(formMessages).text(response);

// Clear the form.
$('#name').val('');
$('#email').val('');
$('#message').val('');
})
.fail(function(data) {
// Make sure that the formMessages div has the 'error' class.
$(formMessages).removeClass('alert-success');
$(formMessages).addClass('alert-danger');

// Set the message text.
if (data.responseText !== '') {
    $(formMessages).text(data.responseText);
} else {
    $(formMessages).text('Oops! An error occured and your message could not be sent.');
}
});
});
});
