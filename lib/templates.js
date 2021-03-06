
var nunjucks = require('nunjucks');
var moment = require('moment');
var qs = require('qs');

/**
 * templates
 * @augments Augments the apos object with facilities for rendering Nunjucks templates
 * with access to appropriate data.
 * @see  aposLocals
 */

var _ = require('underscore');
var async = require('async');

module.exports = function(self) {
  self.render = function(res, template, info) {
    return res.send(self.partial(template, info));
  };

  // Load and render a Nunjucks template by the specified name and give it the
  // specified data. All of the Apostrophe helpers are available as
  // aposArea, etc. from the template. You can also render another partial
  // from within your template by calling {{ partial('name') }}. You can pass a
  // full path for 'name' otherwise it is assumed to be relative to 'dir',
  // or to the Apostrophe's views folder if 'dir' is not specified.
  //
  // The .html extension is assumed.

  self.partial = function(name, data, dirs) {
    if (!data) {
      data = {};
    }

    if (typeof(data.partial) === 'undefined') {
      data.partial = self.partial;
    }

    // Make sure the apos-specific locals are visible to partials too.
    // If we import ALL the locals we'll point at the wrong views directory
    // and generally require the developer to worry about not breaking
    // our partials, which ought to be a black box they can ignore.

    _.defaults(data, self._aposLocals);

    return self.getNunjucksEnv(dirs).getTemplate(name + '.html').render(data);
  };

  var nunjucksEnvs = {};

  /**
   * Get a nunjucks environment in which "include," "extends," etc. search the
   * specified directories. You may specify a single directory or skip the
   * parameter. The views folder of the Apostrophe module is always the
   * last directory searched and you do not need to add it explicitly.
   * USUALLY YOU SHOULD USE apos.partial which invokes this method automatically.
   * Note you can specify search directories when calling apos.partial.
   * @param  {Array} dirs
   * @return {Object} a nunjucks environment
   */
  self.getNunjucksEnv = function(dirs) {
    if (!dirs) {
      dirs = [];
    }

    if (!Array.isArray(dirs)) {
      dirs = [ dirs ];
    }

    dirs = dirs.concat(self.options.partialPaths || []);

    // The apostrophe module's views directory is always the last
    // thing tried, so that you can extend the widgetEditor template, etc.
    dirs = dirs.concat([ __dirname + '/../views' ]);

    var dirsKey = dirs.join(':');
    if (!nunjucksEnvs[dirsKey]) {
      nunjucksEnvs[dirsKey] = self.newNunjucksEnv(dirs);
    }
    return nunjucksEnvs[dirsKey];
  };

  /**
   * Create a new nunjucks environment in which the specified directories are
   * searched for includes, etc. USUALLY YOU SHOULD USE getNunjucksEnv INSTEAD to avoid
   * creating environments over and over for the same search path, which is inefficient.
   * @param  {Array} dirs
   * @return {Object} A nunjucks environment
   */
  self.newNunjucksEnv = function(dirs) {

    var nunjucksEnv = new nunjucks.Environment(new nunjucks.FileSystemLoader(dirs));

    nunjucksEnv.addFilter('date', function(date, format) {
      var s = moment(date).format(format);
      return s;
    });

    nunjucksEnv.addFilter('query', function(data) {
      return qs.stringify(data);
    });

    nunjucksEnv.addFilter('json', function(data) {
      return JSON.stringify(data);
    });

    nunjucksEnv.addFilter('qs', function(data) {
      return qs.stringify(data);
    });

    // See apos.build

    nunjucksEnv.addFilter('build', self.build);

    nunjucksEnv.addFilter('stripTags', function(data) {
      return data.replace(/(<([^>]+)>)/ig,"");;
    });

    nunjucksEnv.addFilter('nlbr', function(data) {
      data = self.globalReplace(data, "\n", "<br />\n");
      return data;
    });

    nunjucksEnv.addFilter('css', function(data) {
      return self.cssName(data);
    });

    nunjucksEnv.addFilter('truncate', function(data, limit) {
      return self.truncatePlaintext(data, limit);
    });

    nunjucksEnv.addFilter('jsonAttribute', function(data) {
      // Leverage jQuery's willingness to parse attributes as JSON objects and arrays
      // if they look like it. TODO: find out if this still works cross browser with
      // single quotes, all the double escaping is unfortunate
      if (typeof(data) === 'object') {
        return self.escapeHtml(JSON.stringify(data));
      } else {
        // Make it a string for sure
        data += '';
        return self.escapeHtml(data);
      }
    });

    return nunjucksEnv;
  };
};
