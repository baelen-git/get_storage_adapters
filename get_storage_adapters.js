importPackage(java.util);
importPackage(java.net);
importPackage(java.lang);
importPackage(com.vmware.vim25);
importPackage(com.vmware.vim25.mo);
importPackage(com.cloupia.model.cIM);
importPackage(com.cloupia.service.cIM.inframgr);
importPackage(com.cloupia.lib.cIaaS.vmware);
importPackage(com.cloupia.lib.cIaaS.netapp);
importPackage(com.cloupia.lib.cIaaS.netapp.model);
importPackage(com.cloupia.feature.networkController);
importPackage(com.cloupia.feature.networkController.model);
importPackage(com.cloupia.lib.cIaas.network.model);
importPackage(com.cloupia.feature.networkController.collector);
importPackage(com.cloupia.lib.util);

var dcName = input.netdevice.split('@')[0];
var devIP = input.netdevice.split('@')[1];

function getNetAppApi() {
	var filerIdentity = new NetAppFilerIdentity(input.NAFiler);
	var accountName = null;
	if (filerIdentity != null) { accountName = filerIdentity.getAccountName(); }
	var account = InfrastructureDataUtil.getAccount(accountName);
	//logger.addInfo("account: " + account);
	var session = new NetAppSession(account);
	//logger.addInfo("session: " + session);
	var api = new NetAppAPI(session);
	//logger.addInfo("API: " + api);
	return api;
};
function getTargets() {
	var na = getNetAppApi();
	var TargetList = new Array();
	var FCPInterfaceList = na.getNetAppClusterFCPInterfaceInfo();
	//logger.addInfo( "FCPInterfaceList :" +  FCPInterfaceList )
	for (var i = 0; i < FCPInterfaceList.length; i++) {
		/*
		logger.addInfo( "FCPInterfaceList[] :" +  FCPInterfaceList[i] )
		logger.addInfo( "getCurrentNode :" +  FCPInterfaceList[i].getCurrentNode() )
		logger.addInfo( "getCurrentPort :" +  FCPInterfaceList[i].getCurrentPort() )
		logger.addInfo( "getInterfaceName :" +  FCPInterfaceList[i].getInterfaceName() )
		logger.addInfo( "getPortName :" +  FCPInterfaceList[i].getPortName() )
		*/

		var devAliasName = FCPInterfaceList[i].getCurrentNode().concat("-" + FCPInterfaceList[i].getCurrentPort());
		var pwwn = FCPInterfaceList[i].getPortName()
		TargetList[i] = new Array(devAliasName, pwwn);
		Create_Device_Alias(devAliasName, pwwn);
	};
	return TargetList;
	//logger.addInfo( "Targets :" +  TargetList )
}
function getFlogiDatabase() {
	var flogi_wwpn = new Array();
	var flogi = NetworkPersistenceUtil.getDeviceFabLogin(dcName, devIP, "");
	//logger.addInfo(flogi);
	for (var i = 0; i < flogi.length; i++) {
		flogi_wwpn[i] = flogi[i].getWwpn();
	}
	logger.addInfo("Logged in WWPNs: " + flogi_wwpn);
	return flogi_wwpn;
}
function configureZones(InitiatorList, TargetList, flogi_wwpn) {

	var LoggedInTargets = new Array();
	var count = 0;
	var zoneset = "SAN_ZONESET_" + input.VSAN

	for (i = 0; i < TargetList.length; i++) {
		if (flogi_wwpn.indexOf(TargetList[i][1]) > -1) {
			LoggedInTargets[count] = TargetList[i];
			count++;
			logger.addInfo("Target: " + TargetList[i][1] + " is logged in to the fabric.")
		} else {
			logger.addInfo("Target: " + TargetList[i][1] + " is NOT logged in to the fabric.")
		}
	}

	for (i = 0; i < InitiatorList.length; i++) {
		if (flogi_wwpn.indexOf(InitiatorList[i][1]) > -1) {
			var failedMessages = new ArrayList();
			var cmdAndOutputMsgs = new ArrayList();
			var errCounter = new Counter();
			var script = new CLIScript();
			var actionLogger = new ArrayList();
			var target = LoggedInTargets[0];
			var zonename = InitiatorList[i][0].concat("-", target[0].split('-')[0]);
			var devCreds = NetworkPersistenceUtil.getDeviceCredential(dcName, devIP);
			try { var device = NetworkDeviceManager.getDevice(devCreds); } catch (e) {
				logger.addError("Exception occured in getDevice function " + e);
				ctxt.setFailed("Workflow task failed");
				throw e;
			}
			/*
					logger.addInfo("zonename " + zonename)
					logger.addInfo("Initiator: " + InitiatorList[i][1] + " is logged in to the fabric.")
					logger.addInfo("dcName " + dcName)
					logger.addInfo("devIP " + devIP)
					logger.addInfo("devCreds " + devCreds.getDeviceIp())
					logger.addInfo("device " + device)
		*/

			script.addLine("!abort");
			script.addLine("!confmode");
			script.addLine("configure terminal");
			script.addLine("zoneset name " + zoneset + " vsan " + input.VSAN);
			script.addLine("zone name " + zonename);
			//script.addLine("zone name " + zonename + " vsan " + input.VSAN);
			script.addLine("member device-alias " + InitiatorList[i][0]);
			for (j = 0; j < LoggedInTargets.length; j++) {
				script.addLine("member device-alias " + LoggedInTargets[j][0]);
			}
			script.addLine("zoneset activate name " + zoneset + " vsan " + input.VSAN);
			script.addLine("zone commit vsan " + input.VSAN);

			script.execute(device, errCounter, failedMessages, cmdAndOutputMsgs);
			// Log commands and their responses
			NetworkDBUtil.logCommandsAndResponses(logger, devCreds, cmdAndOutputMsgs);
			// Append any exceptions to action logger
			NetworkDBUtil.logCommandExceptions(logger, devCreds, errCounter, failedMessages);
		} else {
			logger.addInfo("Initiator: " + InitiatorList[i][1] + " is NOT logged in to the fabric.")
		}
	}
}
function getInitiators() {
	var hosts = new Array();
	var esx_hosts = input.esxhosts.split(',');

	for (x = 0; x < esx_hosts.length; x++){
		try {
			var ESX_hostname = esx_hosts[x].split('@')[1];
			logger.addInfo("ESX Hostname " + ESX_hostname );
			logger.addInfo("Connecting to vCenter account " + input.vmacc + " ...");
			var accountName = input.vmacc;
			var act = InfraPersistenceUtil.getAccount(accountName);
			var si = new VCenterConnectionManager(act).getServiceInstance();
			logger.addInfo("Connected Successfully  " + si);
			var host = new InventoryNavigator(si.getRootFolder()).searchManagedEntity("HostSystem", ESX_hostname );
			logger.addInfo("Host search " + host );
			if (host == null) {
				logger.addError("There is no hosts. Exiting...");
				ctxt.setFailed("Workflow task failed");
				return;
			}
			hosts[x] = host;
		} catch (e) {
			logger.addError("Exception occured in getHostsFromESX " + e);
			ctxt.setFailed("Workflow task failed");
			throw e;
			return;
		}
	}

	logger.addInfo("ESX hosts" + hosts);
	//Get Initiators node names associated with hosts
	if (hosts != null) {
		var InitiatorList = CreateInitiatorDeviceAliases(hosts);
		if (InitiatorList.length > 0) {
			logger.addInfo("Done adding INITIATOR Device Aliases " + InitiatorList);
		} else {
			logger.addError("Failed adding INITIATOR Device Aliases");
			ctxt.setFailed("Task Failed");
		}
	} else {
		logger.addError("There are no hosts identified");
		ctxt.setFailed("Task Failed");
	}
	return InitiatorList;
}

/*
function getHostsInCluster(clustername) {

	var hosts = null;
	try {
		logger.addInfo("Connecting to vCenter account " + input.vmacc + " ...");
		var accountName = input.vmacc;
		var act = InfraPersistenceUtil.getAccount(accountName);
		var si = new VCenterConnectionManager(act).getServiceInstance();
		logger.addInfo("Connected Successfully" + si);
		var cluster = new (si.getRootFolder()).searchManagedEntity("ClusterComputeResource", clustername);
		//logger.addInfo("cluster search " + clustername + act);
		if (cluster == null) {
			logger.addError("There is no cluster. Exiting...");
			ctxt.setFailed("Workflow task failed");
			return;
		}
		logger.addInfo("Retriving hosts from the given cluster");
		hosts = cluster.getHosts();
	} catch (e) {
		logger.addError("Exception occured in getHostsInCluster function " + e);
		ctxt.setFailed("Workflow task failed");
		throw e;
		return;
	}
	return hosts;
}
*/

function CreateInitiatorDeviceAliases(hosts) {

	var InitiatorList = new Array();
	var count = 0;
	try {
		if (hosts != null) {
			logger.addInfo("Number of Hosts: " + hosts.length);
			var host_list = "";
			for (var i = 0; i < hosts.length; i++) {
				var hs = hosts[i];
				logger.addInfo("Host Name: " + hs.getName());
				var host_list = host_list + input.vmacc + "@" + hs.getName() + ",";
				var hss = hs.getHostStorageSystem();
				try {
					var hhbaList = hss.getStorageDeviceInfo().getHostBusAdapter();
					if (hhbaList != null) {
						//logger.addInfo("** HBA HostHostBusAdapter list Size: " +	hhbaList.length);
						var hbaDeviceList = new ArrayList();
						for (var j = 0; j < hhbaList.length; j++) {
							var hhba = hhbaList[j];
							//logger.addInfo("** HBA HostHostBusAdapter: " +hhba.getClass().getSimpleName());
							if (hhba.getClass().getSimpleName().contains("HostFibreChannelHba")) {

								var hbaDevice = hhba.getDevice();
								//logger.addInfo("** HBA Device: " + hbaDevice);
								var AliasName = hs.getName().split('.')[0].concat("-", hbaDevice);
								logger.addInfo("Device Alias Name : " + AliasName);

								var wwpName = Long.toHexString(hhba.getPortWorldWideName());
								var wwpNamefmtd = formatWwpname(wwpName);
								//logger.addInfo("HBA Port WWN: " + wwpName);
								logger.addInfo("HBA Port WWN formated : " + wwpNamefmtd);

								InitiatorList[count] = new Array(AliasName, wwpNamefmtd);
								count++;
								var e = Create_Device_Alias(AliasName, wwpNamefmtd);
							}
						}
					}
				} catch (e) {
					logger.addError("Exception while creating Device Alias: " + e);
					ctxt.setFailed("Workflow task failed");
					return;
				}
			}
		}
	} catch (e) {
		logger.addError("Exception occured in CreateInitiatorDeviceAliases function: " + e);
		ctxt.setFailed("Workflow task failed");
		return;
	}
	return InitiatorList;
}
function formatWwpname(wwpName) {
	var fmt = "";
	try {
		var chars = wwpName.split('');


		for (var i = 0, count = 0; i < chars.length; i++) {
			count++;
			fmt = fmt + chars[i];
			if (count == 2 && i != chars.length - 1) {
				fmt = fmt + ":";
				count = 0;
			}
		}
	} catch (e) {
		logger.addError("Error Occured in formatWwpname: " + e);
		ctxt.setFailed("Task Failed");
	}
	return fmt;
}
function Create_Device_Alias(devAliasName, pwwn) {
	/*
	// check if there already is a device alias with this name on this host
	//var devicealiases = getAllDeviceAliasesPerDevice(dcName,devIP,"");
	//var alias_index = devicealiases.getAliasName().indexOf(devAliasName);
	if ( alias_index > -1 ) {
		if ( devicealiases.getAliasName()
	}
	*/
	var task = ctxt.createInnerTaskContext("Create Device Alias");

	task.setInput("Select Device", input.netdevice);
	task.setInput("Device Alias Name", devAliasName);
	task.setInput("Enter port WWN", pwwn);
	task.setInput("Copy Running configuration to Startup configuration", false);

	/*	logger.addInfo(task);
		logger.addInfo(pwwn);
		logger.addInfo(input.netdevice);
		logger.addInfo(devAliasName); 
	*/
	// Now execute the task. If the task fails, then it will throw an exception
	task.execute();
	logger.addInfo("Added Device Alias: " + devAliasName + " wwpn: " + pwwn);
}

var initiators = getInitiators();
var targets = getTargets();
var flogi = getFlogiDatabase();

configureZones(initiators, targets, flogi);