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

(function( $ ) { //begin closure to make internal functions private

	var regx = /^(((([^:\/#\?]+:)?(?:(\/\/)((?:(([^:@\/#\?]+)(?:\:([^:@\/#\?]+))?)@)?(([^:\/#\?\]\[]+|\[[^\/\]@#?]+\])(?:\:([0-9]+))?))?)?)?((\/?(?:[^\/\?#]+\/+)*)([^\?#]*)))?(\?[^#]+)?)(#.*)?/;
	var iconAPI = 'http://www.google.com/s2/favicons?domain='; // Google API for favicons 
	
	function getSiteIcon ( url ) {
		return iconAPI + regx.exec(url)[11];
	}

	var LinkRoller = function(options) {
		this.init(options);
	}

	/**
	 * prototype
	 */
	LinkRoller.prototype = {
		settings : {},
		init : function(options) {
			this.settings = $.extend({}, $.fn.linkroll.defaults, options);
		},
		loadJSON : function (node) {
			$.getJSON( this.settings.json, function(data) {
				var items = [];
				$.each(data, function( index, value ) {
					items.push("<h3>" + value.category + "</h3><div><ul>");
					$.each(value.links, function(index2, site) {
						items.push("<li style=\"list-style-image: url('"
								+ getSiteIcon(site.link)
								+ "');\"><a href='" + site.link + "'>" + site.name
								+ "</a></li>");
					});
					items.push("</ul></div>");
				});
				node.html(items.join(""));
			});

		}
	};//end prototype

	/**
	 * add DOM chaining method to global jQuery object 
	 */
	$.fn.linkroll = function(options) {
		var roller = new LinkRoller(options);
		return this.each(function(){
			var node = $(this);
			if (roller.settings.json) {
				roller.loadJSON(node);
			}
//			$("#linkroll").accordion({
//				collapsible : true
//			});
		});
	};

	/**
	 * default configuration is globally accessible
	 */
	$.fn.linkroll.defaults = {
		json  : false
		
	};

}(jQuery)); //end of IIFE (see http://benalman.com/news/2010/11/immediately-invoked-function-expression/ )