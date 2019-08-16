var url_action = 'term_in=201920&sel_subj=dummy&sel_subj=STAT&SEL_CRSE=3600&SEL_TITLE=&BEGIN_HH=0&BEGIN_MI=0&BEGIN_AP=a&SEL_DAY=dummy&SEL_PTRM=dummy&END_HH=0&END_MI=0&END_AP=a&SEL_CAMP=dummy&SEL_SCHD=dummy&SEL_SESS=dummy&SEL_INSTR=dummy&SEL_INSTR=%25&SEL_ATTR=dummy&SEL_ATTR=%25&SEL_LEVL=dummy&SEL_LEVL=%25&SEL_INSM=dummy&sel_dunt_code=&sel_dunt_unit=&call_value_in=&rsts=dummy&crn=dummy&path=1&SUB_BTN=View+Sections';
var url_base = 'https://ssbprod.auburn.edu/pls/PROD/bwskfcls.P_GetCrse';

/*var xhr = new XMLHttpRequest();
xhr.open("GET", url_base + url_action, true);
xhr.onreadystatechange = function() {
  if(xhr.readyState == 4) {
    console.log(xhr.responseText)
  }
}
xhr.send();*/

$.ajax({
  url: url_base,
  cache: false,
  data: url_action,
  dataType: "json",
  success: function(data) {
    console.log(data);
  },
  error: function(data) {console.log(data);},
})
