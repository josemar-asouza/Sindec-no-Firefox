const sindecIWebProgressListener = Components.interfaces.nsIWebProgressListener;

function startExtension (event){
	if (Services.prefs.getBoolPref("extensions.sindecNoFirefox.active")){
		setCheckBoxes(true);
		initialize();
	}
	else {
		setCheckBoxes(false);
	}
}

// Initializes the extension
function initialize (event) {
	sindecListener.add();
	gBrowser.addTabsProgressListener(sindecTabsListener, sindecIWebProgressListener);
	window.removeEventListener("load", initialize, false);
	redirectSindecPage(true);
}

// Uninitializes the extension
function uninitialize (event) {
	sindecListener.remove();
	gBrowser.removeTabsProgressListener(sindecTabsListener, sindecIWebProgressListener);
	redirectSindecPage(false);
}

function checkboxClick (event, active){
	if (active){
		initialize();
	}
	else {
		uninitialize();
	}
	setCheckBoxes(active);
}

function setCheckBoxes (active){
	if (active){
		document.getElementById("sindecEnabled").setAttribute("checked", true);
		document.getElementById("sindecEnabled").setAttribute("disabled", true);
		document.getElementById("sindecDisabled").setAttribute("checked", false);
		document.getElementById("sindecDisabled").setAttribute("disabled", false);
		Services.prefs.setBoolPref("extensions.sindecNoFirefox.active", true);
	}
	else {
		document.getElementById("sindecEnabled").setAttribute("checked", false);
		document.getElementById("sindecEnabled").setAttribute("disabled", false);
		document.getElementById("sindecDisabled").setAttribute("checked", true);
		document.getElementById("sindecDisabled").setAttribute("disabled", true);
		Services.prefs.setBoolPref("extensions.sindecNoFirefox.active", false);
	}
}

function getSindecURI (uri){
	return uri.toString().match("http:\/\/[www\.]*sindec.*gov\.br\/sindec");
}

//Redireciona para a página inicial do Sindec caso a página de "incompativel" esteja aberta e o complemento ativado ou o oposto
function redirectSindecPage (active){
	for (var i = gBrowser.tabs.length - 1; i >= 0; --i){
		var browser = gBrowser.getBrowserAtIndex(i);
		var uri = browser.currentURI.spec;
		if (active){
			if (uri.match("http:\/\/[www\.]*sindec.*gov\.br\/sindec\/incompativel.asp"))
				browser.loadURI(getSindecURI(uri)+"/default.asp");
		}
		else {
			if (getSindecURI(uri))
				browser.loadURI(getSindecURI(uri)+"/incompativel.asp");
		}
	}
}

//Modify Sindec cookie
function modifySindecCookie (pageURL){
	var cookiemanager = CCIN ("@mozilla.org/cookiemanager;1", "nsICookieManager2");
	var pageDomain = pageURL.toString().match("[www\.]*sindec.*gov\.br");
	var enumerator = cookiemanager.getCookiesFromHost(pageDomain);
	while (enumerator.hasMoreElements()){
		var cookie = enumerator.getNext();
		if (!cookie)
			break;
		cookie = cookie.QueryInterface(Components.interfaces.nsICookie2);
		with (cookie){
			if (name == "cook%5FSND"){
				if (path == "/sindec"){
					cookiemanager.remove(pageDomain, name, path, false);
					var cookieString  = "cook%5FSND="+value+"; host="+pageDomain+"; expires=0; path=/;";
					var uri = CCIN("@mozilla.org/network/standard-url;1", "nsIURI");
					uri.spec  = "http://"+pageDomain;
					var cservice = CCIN("@mozilla.org/cookieService;1", "nsICookieService");
					cservice.setCookieString(uri, null, cookieString, null);
				}
			}
			if (name == "clickedFolder"){
				if (path == "/sindec"){
					cookiemanager.remove(pageDomain, name, path, false);
					var cookieString  = "clickedFolder="+value+"; host="+pageDomain+"; expires=0; path=/;";
					var uri = CCIN("@mozilla.org/network/standard-url;1", "nsIURI");
					uri.spec  = "http://"+pageDomain;
					var cservice = CCIN("@mozilla.org/cookieService;1", "nsICookieService");
					cservice.setCookieString(uri, null, cookieString, null);
				}
			}
		}
	}
}

// Helper function for XPCOM instanciation (from Firebug)
function CCIN(cName, ifaceName) {
	return Cc[cName].createInstance(Ci[ifaceName]);
}

var sindecListener = {
	observe : function (aSubject, aTopic, aData) {
		if ((aTopic == 'http-on-examine-response') || (aTopic == 'http-on-examine-cached-response')) {
			var oHttp = aSubject.QueryInterface(Ci.nsIHttpChannel);
			var uri = oHttp.URI.asciiSpec;
			if (getSindecURI(uri) || uri.match("http:\/\/[www\.]*sindec.*gov\.br\/sindecrelatorios")){
				if ((uri.indexOf("funcoes_uteis.js") > 0)) {
					var newListener = new TracingListenerScript();
					aSubject.QueryInterface(Ci.nsITraceableChannel);
					newListener.originalListener = aSubject.setNewListener(newListener);
				}
				else {
					//Ignora as páginas de pesquisa, pois elas dão estouro de mémoria no TracingListenerPages
					if ((uri.indexOf("pesq_fornecedor.asp")<0) && (uri.indexOf("pesq_consumidor.asp")<0)){
						var newListener2 = new TracingListenerPages();
						aSubject.QueryInterface(Ci.nsITraceableChannel);
						newListener2.originalListener = aSubject.setNewListener(newListener2);
					}
				}
			}
		}
	},
	QueryInterface : function (aIID) {
		if (aIID.equals(Components.interfaces.nsISupports) ||
			aIID.equals(Components.interfaces.nsIObserver)) {
			throw Components.results.NS_ERROR_NO_INTERFACE;
		}
		return this;
	},
	add : function () {
		this.remove();
		Services.obs.addObserver(this, "http-on-examine-response", false);
		Services.obs.addObserver(this, "http-on-examine-cached-response", false);
	},
	remove : function () {
		try {
			Services.obs.removeObserver(this, "http-on-examine-response");
			Services.obs.removeObserver(this, "http-on-examine-cached-response");
		} catch (e) {}
	}
}

var sindecTabsListener = {
	QueryInterface: function(aIID){
		if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
			aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
			aIID.equals(Components.interfaces.nsIXULBrowserWindow) ||
			aIID.equals(Components.interfaces.nsISupports))
			return this;
		throw Components.results.NS_NOINTERFACE;
	},
	onStateChange : function(aBrowser, webProgress, request, aFlags, aStatus){
		if (aFlags & sindecIWebProgressListener.STATE_STOP && aFlags & sindecIWebProgressListener.STATE_IS_NETWORK) {
			var cDoc = aBrowser.contentDocument;
			var uri = aBrowser.currentURI.spec;
			if (getSindecURI(uri)){
				var pageURL = getSindecURI(uri)
				var topo = cDoc.getElementById("topoSindec");
				if (topo){
					var style = topo.getAttribute("style");
					if (style.indexOf("position") < 0){
						style += "; float: left; position: relative; width: 100%;"
						topo.setAttribute("style", style);
					}
				}
				if (uri.indexOf("frame.asp") > 0) {
					var menu = cDoc.getElementById("menudolado");
					if (menu){
						menu.setAttribute("border", "0");
						menu.setAttribute("frameborder", "NO");
						menu.setAttribute("cols", "204,20,*");
						menu.setAttribute("framespacing", "0");
					}
				}
				if (uri.indexOf("entrada.asp") > 0) {
					var httpChannel = request.QueryInterface(Components.interfaces.nsIHttpChannel);
					//Caso apareça a página de erro 500, automaticamente redireciona para a página inicial
					if (httpChannel.responseStatus == 500){
						aBrowser.loadURI(pageURL+"/default.asp");
					}
					else {
						//Altera o botão "Sair" da página inicial para "Voltar"
						var btn = cDoc.getElementsByName("Submit2");
						if (btn.length > 0){
							btn[0].value = "Voltar";
							btn[0].setAttribute("onclick", "javascript:location.href = '"+pageURL+"/default.asp';");
						}
					}
				}
				if (uri.indexOf("expiraData.asp") > 0) {
					aBrowser.loadURI(pageURL+"/default.asp");
				}
				if (uri.indexOf("tentenovamente.asp") > 0) {
					cDoc.getElementsByClassName("txtlink")[0].click();
				}
				if (uri.indexOf("incompativel.asp") > 0) {
					aBrowser.loadURI(pageURL+"/default.asp");
				}
				modifySindecCookie(pageURL);
			}
		}
	},
	onLocationChange	: function(aBrowser, webProgress, request, location){},
	onProgressChange	: function(aBrowser, webProgress, request, curSelf, maxSelf, curTotal, maxTotal){},
	onSecurityChange	: function(aBrowser, webProgress, request, aState){},
	onStatusChange		: function(aBrowser, webProgress, request, aStatus, aMessage){},
	onRefreshAttempted	: function(aBrowser, webProgress, aRefreshURI, aMillis, aSameURI){}
}


//Listener to dynamic modify funcoes_uteis.js
function TracingListenerScript () {
	this.originalListener = null;
	this.receivedData = new Array();
}

TracingListenerScript.prototype = {
	onDataAvailable : function (request, context, inputStream, offset, count) {
		var binaryInputStream = CCIN("@mozilla.org/binaryinputstream;1", "nsIBinaryInputStream");
		var storageStream = CCIN("@mozilla.org/storagestream;1", "nsIStorageStream");
		var binaryOutputStream = CCIN("@mozilla.org/binaryoutputstream;1", "nsIBinaryOutputStream");

		binaryInputStream.setInputStream(inputStream);
		storageStream.init(8192, count, null);
		binaryOutputStream.setOutputStream(storageStream.getOutputStream(0));

		// Copy received data as they come.
		var data = binaryInputStream.readBytes(count);


		data = data.replace("function CompatibilidadeSistema(){", "function CompatibilidadeSistema(){\nreturn true;");

		//Altera bloqueia_alfa
		data = data.replace(/function bloqueia_alfa\(\)\{[\s\S]*function mascara_cep/,
			"function bloqueia_alfa_novo(event){\n"+
			"\treturn (event.charCode === 0 || /\\d/.test(String.fromCharCode(event.charCode)));\n"+
			"}\nfunction mascara_cep");
		
		//Altera mascara_data_hora2
		data = data.replace(/function mascara_data_hora2\(tecla,campo\)\{[\s\S]*function mascara_data_hora3/,
			"function mascara_data_hora_novo(event, campo){\n"+
			"\tvar input = document.getElementById(campo);\n"+
			"\tinput.setSelectionRange(input.value.length, input.value.length);\n"+
			"\tif (event.charCode === 0 || /\\d/.test(String.fromCharCode(event.charCode))) {\n"+
			"\t\tif (/\\d/.test(String.fromCharCode(event.charCode))){\n"+
			"\t\t\tvar a = input.value.replace(/\\//g, '').replace(':', '').replace(/\\s/g, '');\n"+
			"\t\t\tif (a.match('[0-9]{10}'))\n"+
			"\t\t\t\ta = a.replace(/^(\\d{2})(\\d{2})(\\d{4})(\\d{2})(.*)/, '$1/$2/$3 $4:$5');\n"+
			"\t\t\telse if (a.match('[0-9]{8}'))\n"+
			"\t\t\t\ta = a.replace(/^(\\d{2})(\\d{2})(\\d{4})/, '$1/$2/$3 ')\n"+
			"\t\t\telse if (a.match('[0-9]{4}'))\n"+
			"\t\t\t\ta = a.replace(/^(\\d{2})(\\d{2})/, '$1/$2/');\n"+
			"\t\t\telse if (a.match('[0-9]{2}'))\n"+
			"\t\t\t\ta = a.replace(/^(\\d{2})/, '$1/');\n"+
			"\t\t\tinput.value = a;\n"+
			"\t\t}\n"+
			"\t\treturn true;\n"+
			"\t} else\n"+
			"\t\treturn false;\n"+
			"}\n\nfunction mascara_data_hora3"); 

		data = data.replace(/return mascara_data_hora2/gi, "return mascara_data_hora_novo");
		
		//Altera mascara_hora
		data = data.replace(/function mascara_hora\(tecla,campo\)\{[\s\S]*\/\/exibir detalhes/,
			"function mascara_hora_novo(event, campo){\n"+
			"\tif ((event.keyCode==8) || (event.keyCode==46))\n"+
			"\t\treturn;\n"+
			"\tvar input = campo;\n"+
			"\tvar a = input.value.replace(':', '');\n"+
			"\tif (a.match('[0-9]{2}'))\n"+
			"\t\ta = a.replace(/^(\\d{2})/, '$1:');\n"+
			"\tinput.value = a;\n"+
			"}\n\n//exibir detalhes");
		
		//Altera mascara_data
		data = data.replace(/function mascara_data\(campo, valor\)\{[\s\S]*function mascara_mes_ano/,
			"function mascara_data_novo(event, campo, valor){\n"+
			"\tif ((event.keyCode==8) || (event.keyCode==46))\n"+
			"\t\treturn;\n"+
			"\tvar input = document.getElementById(campo);\n"+
			"\tvar a = input.value.replace(/\\//g, '');\n"+
			"\tif (a.match('[0-9]{4}'))\n"+
			"\t\ta = a.replace(/^(\\d{2})(\\d{2})/, '$1/$2/');\n"+
			"\telse if (a.match('[0-9]{2}'))\n"+
			"\t\ta = a.replace(/^(\\d{2})/, '$1/');\n"+
			"\tinput.value = a;\n"+
			"}\n\nfunction mascara_mes_ano");
		
		data = data.replace(/return mascara_data\(objId/gi, "return mascara_data_novo(objEvent,objId");
		
		//Altera mascara_cep
		data = data.replace(/function mascara_cep\(campo, valor\)\{[\s\S]*function verificaCEP/,
			"function mascara_cep_novo(event, campo, valor){\n"+
			"\tif ((event.keyCode==8) || (event.keyCode==46))\n"+
			"\t\treturn;\n"+
			"\tvar a = valor.replace('-', '');\n"+
			"\tif (a.length>4)\n"+
			"\t\ta = a.replace(/^(\\d{5})/, '$1-');\n"+
			"\tvar input = document.getElementById(campo);\n"+
			"\tinput.value = a;\n"+
			"}\n\nfunction verificaCEP");
		
		data = data.replace("if(unicode==16)", "if(e.shiftKey)");
		data = data.replace(" || (unicode >= 96 && unicode <= 105)", "");
		data = data.replace(" || unicode==46) || (unicode >= 37 && unicode <= 40", "");
		
		data = data.replace("function ExibDescri(strTip,strPos)", "function ExibDescri(event, strTip, strPos)");
		data = data.replace(/window\.event\.x/g, "event.clientX");
		data = data.replace(/window\.event\.y/g, "event.clientY");

		data = data.replace(/\.getYear/g, ".getFullYear");
		data = data.replace(/\.keyCode/g, ".which");
		data = data.replace(/intcodfornecedor/g, "intCodFornecedor");
		
		data = data.replace(/document\.form1\.all\[campo\]/g, "document.getElementsByName(campo)[0]");
		data = data.replace(/document\.getElementById\(campo\)/g, "document.getElementsByName(campo)[0]");
		
		data = data.replace(/DATA INCOMPLETA ([dd])/gi, "DATA INCOMPLETA OU INVÁLIDA $1");
			
		count = data.length;
		
		this.receivedData.push (data);
		
		binaryOutputStream.writeBytes(data, count);

		this.originalListener.onDataAvailable(request, context, storageStream.newInputStream(0), offset, count);

	},
	onStartRequest : function (request, context) {
		this.originalListener.onStartRequest(request, context);
	},
	onStopRequest : function (request, context, statusCode) {
		var responseSource = this.receivedData.join("");
		this.originalListener.onStopRequest(request, context, statusCode);
	},
	QueryInterface : function (aIID) {
		if (aIID.equals(Ci.nsIStreamListener) ||
			aIID.equals(Ci.nsISupports)) {
			return this;
		}
		throw Components.results.NS_NOINTERFACE;
	}
}

//Listener to dynamic modify pages
function TracingListenerPages () {
	this.originalListener = null;
	this.receivedData = new Array();
}

TracingListenerPages.prototype = {
	onDataAvailable : function (request, context, inputStream, offset, count) {
		var binaryInputStream = CCIN("@mozilla.org/binaryinputstream;1", "nsIBinaryInputStream");
		var storageStream = CCIN("@mozilla.org/storagestream;1", "nsIStorageStream");
		var binaryOutputStream = CCIN("@mozilla.org/binaryoutputstream;1", "nsIBinaryOutputStream");

		binaryInputStream.setInputStream(inputStream);
		storageStream.init(8192, count, null);
		binaryOutputStream.setOutputStream(storageStream.getOutputStream(0));

		// Copy received data as they come.
		var data = binaryInputStream.readBytes(count);	
		
		var i = data.indexOf("input");
		while (i>0){
			var f = data.indexOf(">", i+5);
			//console.log(i+" - "+f);
			if (f>i){
				var input = data.substring(i,f);
				//Caso o input não possua "id", adicionará o "id" igual ao "name"
				if (input.indexOf("id=") < 0){
					input = input.replace(/name="(\w+)"/gi, 'name="$1" id="$1"');
					data = data.replace(data.substring(i,f), input);
				}
				i = data.indexOf("input", f);
			}
			else
				i = -1;
		}
		
		data = data.replace(/jscript/gi, "javascript");

		data = data.replace(/[return\s]*mascara_data_hora[0-9]*[\s]*\(event[,|\s]*(.*)\)[;]*/gi, 'return mascara_data_hora_novo(event, $1);');
		
		data = data.replace(/"[return\s]*bloqueia_alfa[0-9]*[\s]*\([event]*\)[;]*/gi, '"return bloqueia_alfa_novo(event);');
		
		data = data.replace(/onkeydown="[return|\s]*mascara_cep[\s]*\('(.*)\)"/gi, 'onkeydown="mascara_cep_novo(event,\'$1)"');
		
		data = data.replace(/onkeydown="[return|\s]*mascara_hora[\s]*\([event|,]*(.*)\)/gi, 'onkeydown="mascara_hora_novo(event,$1)"');
		
		data = data.replace(/onkeydown="[return|\s]*mascara_data[\s]*\('(.*)\)"/gi, 'onkeydown="mascara_data_novo(event,\'$1)"');
		
		data = data.replace(/onmouseover="ExibDescri\('/gi, 'onmouseover="ExibDescri(event, \'');

		data = data.replace(/\.keyCode/g, ".which");
		
		data = data.replace(/document\.form1\.strTipo\(([0-9])\)\.checked/g, "document.getElementsByName('strTipo')[$1].checked");
		
		data = data.replace(/display:'none'/g, "display:none");
		
		data = data.replace(/setAttribute\("disabled",false\)/gi, 'removeAttribute("disabled")');
		
		data = data.replace(/width="253"/gi, 'width="320"');
		
		data = data.replace(/document\.getElementById\('form1'\)\.elements/g, "document.form1.elements");
		
		data = data.replace(/="strTelConsumidor" type/g, '="strTelConsumidor" onkeypress="return bloqueia_alfa_novo(event);" type');
		data = data.replace(/="strDDDConsumidor" type/g, '="strDDDConsumidor" onkeypress="return bloqueia_alfa_novo(event);" type');
		
		//Excluir procurador/ fornecedor
		data = data.replace(/language="VBScript"/g, 'language="JavaScript" type="text/JavaScript"');
		data = data.replace(/MsgBox\((".*"), vbYesNo\)/gi, "confirm($1);");
		data = data.replace(/msgResp==6/gi, "msgResp == true");
		
		data = data.replace(/chr\(13\)/gi, '"\\n"');
		data = data.replace(/MsgBox\("(.*)",.*"\)/gi, 'alert("$1");');

		count = data.length;
		
		this.receivedData.push (data);
		
		binaryOutputStream.writeBytes(data, count);

		this.originalListener.onDataAvailable(request, context, storageStream.newInputStream(0), offset, count);

	},
	onStartRequest : function (request, context) {
		this.originalListener.onStartRequest(request, context);
	},
	onStopRequest : function (request, context, statusCode) {
		var responseSource = this.receivedData.join("");
		this.originalListener.onStopRequest(request, context, statusCode);
	},
	QueryInterface : function (aIID) {
		if (aIID.equals(Ci.nsIStreamListener) ||
			aIID.equals(Ci.nsISupports)) {
			return this;
		}
		throw Components.results.NS_NOINTERFACE;
	}
}


window.addEventListener("load", startExtension, false);
window.addEventListener("unload", uninitialize, false);
