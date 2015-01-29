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

	var regx = /^(((([^:\/#\?]+:)?(?:(\/\/)((?:(([^:@\/#\?]+)(?:\:([^:@\/#\?]+))?)@)?(([^:\/#\?\]\[]+|\[[^\/\]@#?]+\])(?:\:([0-9]+))?))?)?)?((\/?(?:[^\/\?#]+\/+)*)([^\?#]*)))?(\?[^#]+)?)(#.*)?/;
	var iconAPI = '//www.google.com/s2/favicons?domain='; // Google API for favicons 
	
	function getIconUrl ( url ) {
		return iconAPI + regx.exec(url)[11];
	}

	function getIconImageTag ( anchor ) {
		var href = $(anchor).attr('href');
		var url = getIconUrl(href);
		var img = $('<img />', {src: url});
		return img;
	}
	
	function buildFromJson ( url, node, callback ) {
		$.getJSON( url, function(data) {
			var items = [];
			$.each(data, function( index, value ) {
				items.push("<h3 class='linkroll'>" + value.category + "</h3><div class='linkroll'><ul class='linkroll'>");
				$.each(value.links, function(index2, site) {
					items.push("<li class='linkroll' style=\"list-style-image: url('"
							+ getIconUrl(site.link)
							+ "');\"><a href='" + site.link + "'>" + site.name
							+ "</a></li>");
				});
				items.push("</ul></div>");
			});
			node.html(items.join(""));
			if ($.isFunction(callback)) {
				callback(node);
			}
		});
	}
	
	
	
	/**
	 * add DOM chaining method to global jQuery object 
	 */
	$.fn.linkroll = function(options) {
//		var roller = new LinkRoller(options);
		var settings = $.extend({}, $.fn.linkroll.defaults, options);
		return this.each(function(){
			var node = $(this);
			if (settings.json) {
				buildFromJson(settings.json, node, settings.onSuccess);
			} else {
				if (node.is('a')) {
					node.prepend(getIconImageTag(node));
				} else {
					node.find('a').each(function (){
						$(this).prepend(getIconImageTag(this));
					});
				}
				if ($.isFunction(settings.onSuccess)) {
					settings.onSuccess(node);
				}
			}
		});
	};

	/**
	 * default configuration is globally accessible
	 */
	$.fn.linkroll.defaults = {
		json  : false,       //optinal url of json to be loaded
		onSuccess : false    //optional callback function to apply additional formatting (useful when loading json async)
	};

}(jQuery)); //end of IIFE (see http://benalman.com/news/2010/11/immediately-invoked-function-expression/ )