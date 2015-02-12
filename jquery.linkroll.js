/**
* linkroll - jQuery plugin to load and/or format linkrolls.
* https://github.com/zachofalltrades/jquery.linkroll
*
* Version - 0.1
* Copyright (c) 2015 Zach Shelton
* http://zachofalltrades.net
*
* Dual licensed under the MIT and GPL licenses:
* http://www.opensource.org/licenses/mit-license.php
* http://www.gnu.org/licenses/gpl.html
*  
*/

(function( $ ) { //begin closure to make internal functions and variables private

	//see http://jsfiddle.net/zachofalltrades/tcgwkns8
	var regx = /^(((([^:\/#\?]+:)?(?:(\/\/)((?:(([^:@\/#\?]+)(?:\:([^:@\/#\?]+))?)@)?(([^:\/#\?\]\[]+|\[[^\/\]@#?]+\])(?:\:([0-9]+))?))?)?)?((\/?(?:[^\/\?#]+\/+)*)([^\?#]*)))?(\?[^#]+)?)(#.*)?/;
	var iconAPI = '//www.google.com/s2/favicons?domain='; 
	var supportedMethods = ['append','prepend','before','after','html'];
	var NodeJitsuJsonP = 'https://jsonp.nodejitsu.com/?callback=?&url=';
	var JsonObj = null; //hold reference to most recently loaded json object
	
	function getIconUrl ( url ) {
		return iconAPI + regx.exec(url)[11];
	}

	function buildFromJson ( jsonData, node, settings ) {
		var items = [];
		var template = settings.jsonTemplate;
		var callback = settings.onSuccess;
		JsonObj = jsonData;
		items.push(template.begin);
		$.each(jsonData, function( index, value ) {
			items.push( template.beforeEachCategory + value.category + template.afterEachCategory);
			items.push(template.beforeLinks);
			$.each(value.links, function(index2, site) {
				if (template.beforeEachLink) {
					items.push(formatSite(site, template.beforeEachLink, template));
				}
				if (template.eachLink) {
					items.push(formatSite(site, template.eachLink, template));
				}
				if (template.afterEachLink) {
					items.push(formatSite(site, template.afterEachLink, template));
				}
			});
			items.push(template.afterLinks);
		});
		items.push(template.end);
		node.html(items.join(""));
		node.addClass(settings.addClass);
		if ($.isFunction(callback)) {
			callback(node);
		}
	}

	function loadFromJsonUrl (node, settings) {
		var url = (settings.useNodeJitsu) ? NodeJitsuJsonP + settings.json : settings.json;
		$.getJSON( url ).done( function(data) {
			buildFromJson(data, node, settings);
		});
	}

	
	function formatSite(site, layout, opts) {
		var url = (typeof site==='object') ? site.link : site;
		var name = (typeof site==='object') ? site.name : regx.exec(site)[11];
		var temp = layout.replace(opts.replaceWithIconUrl, getIconUrl(url));
			temp = temp.replace(opts.replaceWithSiteUrl, url);
			temp = temp.replace(opts.replaceWithSiteName, name);
		return temp;
	}
	
	/**
	 * add DOM chaining method to global jQuery object 
	 */
	$.fn.linkroll = function ( options ) {
//		var roller = new LinkRoller(options);
		var settings = $.extend({}, $.fn.linkroll.defaults, options);
		//ensure that selected method is supported
		settings.method = ($.inArray(settings.method, supportedMethods)) ? settings.method : supportedMethods[0];
		return this.each(function(){
			var node = $(this);
			if (settings.json) {
				loadFromJsonUrl(node, settings);
			} else {
				if (node.is('a')) {
					insertImage(node, settings);
				} else {
					node.find('a').each(function (){
						var subNode = $(this);
						insertImage(subNode, settings);
					});
				}
				if ($.isFunction(settings.onSuccess)) {
					settings.onSuccess(node);
				}
			}
			return this;
		});
	};

	function insertImage ( link, settings ) {
		var href = $(link).attr('href');
		var url = getIconUrl(href);
		var img = $('<img />', {src: url});
		img.addClass(settings.addClass);
		link.addClass(settings.addClass);
		var insertionMethod = link[settings.method];
		insertionMethod.call(link, img);
	}
	
	/**
	 * default configuration is globally accessible
	 */
	$.fn.linkroll.defaults = {
		addClass: 'linkroll',  //class name to add to all created/modified elements
		method: 'prepend',     //jQuery node insertion method for img tag
		json  : false,         //optinal url of json to be loaded
		useNodeJitsu: false,   //set true if json url is (trusted) remote host that does not enable CORS or JSONP
		onSuccess : false,     //optional callback function to apply additional formatting (useful when loading json async)
		jsonTemplate: {
			begin: '',
			beforeEachCategory: '<h3>',
			afterEachCategory: '</h3>',
			beforeLinks: '<div><ul>',
			afterLinks: '</ul></div>',
			beforeEachLink: false,
			eachLink: "<li class='linkroll' style=\"list-style-image: url('##ICONURL##');\"><a href='##SITEURL##'>##SITENAME##</a></li>",
			afterEachLink: false,
			end:   '',
			replaceWithIconUrl: '##ICONURL##',
			replaceWithSiteUrl: '##SITEURL##',
			replaceWithSiteName: '##SITENAME##'
		}
	};
	
	/**
	 * return a 'read-only' copy of the supported insertion methods
	 */
	$.fn.linkroll.methods = function() {
		return 	supportedMethods.slice();
	};
	
	function LinkRoll ( opts ) {
		this.init(opts);
	}
	
	LinkRoll.prototype = {
		options: {},
		init: function(overrides) {
			this.options = $.extend({}, $.fn.linkroll.defaults, overrides);
		},
	};
	
	//feature detection to see if all necessary HTML5 File APIs are supported.
	if (window.File && window.FileReader && window.FileList) {
		$.fn.linkroll.ImportButton = function (nodeToLoad, options) {
			var settings = $.extend({}, $.fn.linkroll.defaults, options);
			var input = $('<input />', {type: 'file', id: 'linkroll.input', name: 'linkroll.files[]'});
			//based on http://jsfiddle.net/8kUYj/234/
			input.on('change', function(evt) {
			    var files = evt.target.files;  // HTML5 FileList
			    var f = files[0];              // HTML5 File
			    var reader = new FileReader(); // HTML5 FileReader
			    reader.onload = (function (theFile) {
			        return function (e) { 
			            var fileObj = e.target.result;
			            var json = JSON.parse(fileObj);
			            buildFromJson ( json, nodeToLoad, settings );
			        };
			    })(f);
			    reader.readAsText(f, 'UTF-8');
			});
			return input;
		};
	} else {
		$.fn.linkroll.ImportButton = function() {
			return false;
		};
		console.log('The File APIs are not fully supported in this browser.');
	}

	var jsonEditorEndpoint = 'https://jsonblob.com';
	var jsonEditorApi = '/api/jsonBlob';
	if (true) {
		$.fn.linkroll.EditButton = function (link, options) {
			var btn = $('<button/>',{type: 'submit', formmethod: 'GET', formtarget: '_blank'});
			btn.html('edit');
			btn.click(function() {
				var jsonData = JsonObj;
				var jsonTxt = JSON.stringify(jsonData);
				$.ajax({
					url: jsonEditorEndpoint + jsonEditorApi,
					contentType: 'application/json; charset=utf-8',
					type: 'POST',
					//dataType: 'json',
					data: jsonTxt,
					error: function (xhr, status) {
						alert(status);
					},
					success: function (data, status, xhr) {
						console.log(data);
						console.log(status);
						console.log(xhr);
						var location = xhr.getResponseHeader("location");
						alert(location);
						var editor = location.replace(jsonEditorApi, '');
						window.open(editor);
					}
				});
				// var tmp = $('<form/>', {
				// 	method: 'POST', 
				// 	target: "_blank",
				// 	action: 'https://jsonblob.com/api/jsonBlob'
				// });
				// $("body").append(tmp);
				// tmp.submit();
				// tmp.remove();
			});
			return btn;
		};
	} else {
		console.log('The File APIs are not fully supported in this browser.');
	}

	if (true) {
	$.fn.linkroll.ExportButton = function (link, options) {
		var btn = $('<button/>',{type: 'submit', formmethod: 'GET', formtarget: '_blank'});
		btn.html('export');
		btn.click(function() {
			var data = JsonObj;
			var jsonTxt = JSON.stringify(data);
			var blob = new Blob([jsonTxt], {type: "application/json"});
			//btn.formaction = URL.createObjectURL(blob);
			var tmp = $('<form/>', {
				method: 'GET', 
				target: "_blank",
				action: URL.createObjectURL(blob)
			});
			$("body").append(tmp);
			tmp.submit();
			tmp.remove();
		});
		return btn;
		}
	} else {
		console.log('The File APIs are not fully supported in this browser.');
	}

}(jQuery)); //end of IIFE (see http://benalman.com/news/2010/11/immediately-invoked-function-expression/ )