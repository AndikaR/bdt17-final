let mongoose = require('../global').mongoose;

module.exports = () => {
  mongoose.model('members', new mongoose.Schema({
    username: String,
    password: String,
    email: String
  }, {
    collection: 'members'
  }));
};