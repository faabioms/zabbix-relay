var BaseAdapter = require('./baseAdapter');
var util = require('util');
var elasticsearch = require('elasticsearch');
var moment = require('moment');
var _ = require('lodash');

function ElasticAdapter(uri) {
  BaseAdapter.call(this);
  this._client = new elasticsearch.Client({
    host: uri
  });
}

util.inherits(ElasticAdapter, BaseAdapter);

ElasticAdapter.prototype.transport = function(data, done) {
  var self = this;
  this._client.ping({
    requestTimeout: 1000,
  }, function(error) {
    if (error) {
      done(error);
    } else {
      self._client.bulk({
        body: data
      }, done);
    }
  });
};

ElasticAdapter.prototype.parse = function(data, histype) {
  var bulk_message = [];
  var row = data.data;
  var host = data.host;
  var item = data.item;
  var app_name = item.applications.length === 0 ? 'Other' : item.applications[0].name;
  var item_name = this._resolveItemNames(item);
  var target_index = util.format('zabbix.archive-%s', moment.unix(row.clock).format('YYYY.MM.DD'));
  var clock = parseInt(row.clock + '000');
  var unique_id = this._generateUniqueId();

  var record = {
    _id: unique_id,
    '@timestamp': clock,
    host: host.host,
    item: item_name,
    key: item.key_,
    app: app_name,
  };
  var type = '';
  if (histype === 'history') {
    record.value = row.value;
    type = 'zabbix-history';
  }
  else {
    record = _.merge(record, {
      min: row.value_min,
      max: row.value_max,
      avg: row.value_avg
    });
    type = 'zabbix-archive';
  }

  var meta = {
      index: {
      _index: target_index,
      _type: type,
      _id: unique_id,
    }
  };

  bulk_message.push(meta, record);
  return bulk_message;
};

module.exports = ElasticAdapter;