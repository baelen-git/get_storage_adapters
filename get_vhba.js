importPackage(com.cloupia.service.cIM.inframgr);
importPackage(com.cloupia.feature.ucsController);
importPackage(com.cloupia.model.cIM);

var SPS = UcsDataPersistenceUtil.getServiceProfileForAcc(input.UCS_Account);
for (x = 0; x < SPS.length; x++) { 
    var SP = SPS[x].getName();
    var SP_state = SPS[x].getAssocState();
    vhbas = SPS[x].getSpVHBA();
    logger.addInfo("SP Name: " + SP );
    for (i = 0; i < vhbas.length; i++){
        name = vhbas[i].getName();
        wwpn = vhbas[i].getAddr();
        logger.addInfo("Name: " + name + " WWPN: " + wwpn);
    }
}


/*
var api = UcsDataPersistenceUtil.getNewUcsAPISession(account);
var cookie = api.getLoginResponse().getOutCookie();
var sessionId = api.getSessionId();
*/



