# jquery.linkroll
A jQuery plugin to iconize links and/or load a load bookmark widget from JSON data.
- project:   http://github.com/zachofalltrades/jquery.linkroll/
- live demo: http://zachofalltrades.github.io/jquery.linkroll/

## Features
 - add a favicon, before, after, or in place of any  '< a >' tag in a set of matched elements
 - create a dynamic data-driven bookmark widget from json data
 - support Chrome and Firefox json bookmark formats
 - edit and reload json data in the browser
 - optional use of cookie for widget to remember url for json data
 - json file upload
 - optional use of public jsonp proxy to access json from non-jsonp or CORS enabled remote hosts
 
## Requirements
 - jQuery 1.8 (possibly as old as 1.6)
 - jQuery UI (optional for widget enhancements)

## Credits
Favicons are taken from  the Google Shared Stuff (S2) favicon endpoint:
google.com/s2/favicons?domain=<hostname.tld>

Editor functionality is (currently) handled in the cloud via "JSON Blob"
https://jsonblob.com/about

Proxy functionality is handled in the cloud via NodeJitsu
https://jsonp.nodejitsu.com/

## License
MIT & GPL

## Author
(c) Zach Shelton <zachofalltrades@users.sourceforge.com> (http://zachofalltrades.net)
