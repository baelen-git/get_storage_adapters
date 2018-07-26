/*
importPackage(java.util);
importPackage(java.lang);
importPackage(java.io);
importPackage(com.cloupia.model.cEvent.notify);
importPackage(com.cloupia.model.cIM);
importPackage(com.cloupia.lib.util.mail);
importPackage(com.cloupia.fw.objstore);
importPackage(com.cloupia.lib.util.managedreports);
 */

var AdapterList = "LAB@admin@10.160.63.40@20:00:00:a0:98:57:a2:68,LAB@admin@10.160.63.40@20:01:00:a0:98:57:a2:68";

var IntString = "";
var AdapterArray = AdapterList.split(',');

var NrAdapters = AdapterArray.length;
for (var i = 0; i < NrAdapters; i++) {
	var Values = InterfacesArray[i].split('@');
	var ValuesLength = Values.length;
    if ( i+1 < NrInterfaces) { 
        IntString += Values[ValuesLength-1] + ",";
    } else { 
        IntString += Values[ValuesLength-1];
    };
};


/*alert(IntString);*/
InterfaceString = IntString;