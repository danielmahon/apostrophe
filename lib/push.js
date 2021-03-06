var _ = require('underscore');

/**
 * push
 * @augments Augments the apos object with methods, routes and
 * properties supporting the serving of specific assets (CSS, templates and
 * browser-side JavaScript) required by Apostrophe.
 * @see static
 */

module.exports = function(self) {
  // Make a pushCall method available on the request object,
  // which is called like this:
  //
  // req.pushCall('my.browserSide.method(?, ?)', arg1, arg2, ...)
  //
  // Each ? is replaced by a properly JSON-encoded version of the
  // next argument.
  //
  // If you need to pass the name or part of the name of a function dynamically,
  // you can use @ to pass an argument literally:
  //
  // req.pushCall('new @(?)', 'AposBlog', { options... })
  //
  // These calls can be returned as a single block of browser side
  // js code by invoking:
  //
  // apos.calls(req)
  //
  // The req object is necessary because the context for these calls
  // is a single page request. You will typically invoke this from a
  // route function or from middleware. The pages module automatically
  // passes this ready-to-run JS source code as the 'calls' property of
  // the data object given to the page template.
  //
  // You may also call:
  //
  // apos.pushGlobalCallWhen('user', 'my.browserSide.method(?, ?)', arg1, arg2, ...)
  //
  // Which pushes a call that will be included EVERY TIME
  // apos.globalCallsWhen('user') is invoked. This is NOT specific
  // to a single request and should be used for global client-side
  // configuration needed at all times. The pages module automatically
  // passes this code as the 'globalCalls' property of the data object given
  // to the page template.

  self.app.request.pushCall = function(pattern) {
    var req = this;
    if (!req._aposCalls) {
      req._aposCalls = [];
    }
    // Turn arguments into a real array https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Functions_and_function_scope/arguments
    var args = Array.prototype.slice.call(arguments);
    req._aposCalls.push({
      pattern: pattern,
      arguments: args.slice(1)
    });
  };

  self.getCalls = function(req) {
    return self._getCalls(req._aposCalls || []);
  };

  self._globalCalls = {};

  // Push a browser side JS call that will be invoked 'when'
  // a particular situation applies. Currently 'always' and
  // 'user' (a logged in user is present) are supported. Any
  // @'s and ?'s in 'pattern' are replaced with the remaining arguments
  // after 'when'. @ arguments appear literally (useful for
  // constructor names) while ? arguments are JSON-encoded.
  //
  // Example:
  // apos.pushGlobalCallWhen('user', 'aposPages.addType(?)', typeObject)

  self.pushGlobalCallWhen = function(when, pattern) {
    // Turn arguments into a real array https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Functions_and_function_scope/arguments
    var args = Array.prototype.slice.call(arguments);
    if (!self._globalCalls[when]) {
      self._globalCalls[when] = [];
    }
    self._globalCalls[when].push({ pattern: pattern, arguments: args.slice(2) });
  };

  self.getGlobalCallsWhen = function(when) {
    var s = self._getCalls(self._globalCalls[when] || []);
    return s;
  };

  // Turn any number of call objects like this:
  // [ { pattern: @.func(?), arguments: [ 'myFn', { age: 57 } ] } ]
  //
  // Into javascript source code like this:
  //
  // myFn.func({ age: 57 });
  // ... next call here ...
  //
  // Suitable to be emitted inside a script tag.
  //
  // Note that ? JSON-encodes an argument, while @ inserts it literally.

  self._getCalls = function(calls) {
    return _.map(calls, function(call) {
      var code = '  ';
      var pattern = call.pattern;
      var n = 0;
      var from = 0;
      while (true) {
        var qat = pattern.substr(from).search(/[\?\@]/);
        if (qat !== -1) {
          qat += from;
          code += pattern.substr(from, qat - from);
          if (pattern.charAt(qat) === '?') {
            // ? inserts an argument JSON-encoded
            code += JSON.stringify(call.arguments[n++]);
          } else {
            // @ inserts an argument literally, unquoted
            code += call.arguments[n++];
          }
          from = qat + 1;
        } else {
          code += pattern.substr(from);
          break;
        }
      }
      code += ";";
      return code;
    }).join("\n");
  };

  self.pushGlobalCallWhen('user', 'apos.enableAreas()');
  self.pushGlobalCallWhen('always', 'apos.enablePlayers()');

  // Pass data to JavaScript on the browser side. We extend the app.request template
  // so that req.pushData() is a valid call.
  //
  // req.pushData() expects an object. The properties of this object are
  // merged recursively with the browser side apos.data object, using the
  // jQuery extend() method. You can make many calls, merging in more data,
  // and unspool them all
  // as a block of valid browser-ready javascript by invoking apos.getData(req).
  // The pages module automatically does this and makes that code available
  // to the page template as the `data` property.

  self.app.request.pushData = function(datum) {
    var req = this;
    if (!req._aposData) {
      req._aposData = [];
    }
    req._aposData.push(datum);
  };

  self.getData = function(req) {
    return self._getData(req._aposData || []);
  };

  self._globalData = [];

  // Make global settings such as apos.data.uploadsUrl available to the browser. You
  // can push more data by calling apos.pushGlobalData(). $.extend is used
  // to merge consecutive pushes that refer to the same parent elements. This
  // global data is returned as ready-to-run JS code EVERY TIME apos.getGlobalData()
  // is called. For data that is specific to a single request, see
  // req.pushData and apos.getData().
  //
  // The pages module automatically calls apos.getGlobalData() and makes that
  // code available to the page template as the `data` property.

  self.pushGlobalData = function(datum) {
    self._globalData.push(datum);
  };

  self.getGlobalData = function() {
    return self._getData(self._globalData || []);
  };

  self._getData = function(data) {
    var code = '  apos.data = apos.data || {};\n';
    code += _.map(data, function(datum) {
      return '  $.extend(true, apos.data, ' + JSON.stringify(datum) + ');';
    }).join("\n");
    return code;
  };
};
