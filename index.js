
var Mailgun = require('mailgun-js');
var mailcomposer = require('mailcomposer');
var path = require('path');
var fs = require('fs');

var defaultBodyHTML;

var SimpleMailgunAdapter = mailgunOptions => {
  if (!mailgunOptions || !mailgunOptions.apiKey || !mailgunOptions.domain || !mailgunOptions.fromAddress) {
    throw 'SimpleMailgunAdapter requires an API Key, domain, and fromAddress.';
  }

  var _messages;
  var _customFillVariables;

  mailgunOptions.verificationSubject =
    mailgunOptions.verificationSubject ||
    'Please verify your e-mail for %appname%';
  mailgunOptions.verificationBody =
    mailgunOptions.verificationBody ||
    'Hi,\n\nYou are being asked to confirm the e-mail address %email% ' +
    'with %appname%\n\nClick here to confirm it:\n%link%';
  mailgunOptions.passwordResetSubject =
    mailgunOptions.passwordResetSubject ||
    'Password Reset Request for %appname%';
  mailgunOptions.passwordResetBody =
    mailgunOptions.passwordResetBody ||
    'Hi,\n\nYou requested a password reset for %appname%.\n\nClick here ' +
    'to reset it:\n%link%';


  if ( mailgunOptions.messagesFile ){
    _messages = require( path.join(process.cwd() , mailgunOptions.messagesFile ) );
  }

  if ( mailgunOptions.fillVariables ){
    _customFillVariables = require( path.join(process.cwd() , mailgunOptions.fillVariables ) );
  }

  var mailgun = Mailgun(mailgunOptions);

  function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
  }

  function replaceAll(str, find, replace) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
  }

  function fillVariables(text, options) {
    text = replaceAll(text, "%username%", options.user.get("username") || options.user.get("firstName") );
    text = replaceAll(text, "%name%", options.user.get("name"));
    text = replaceAll(text, "%firstName%", options.user.get("firstName"));
    text = replaceAll(text, "%email%", options.user.get("email"));
    text = replaceAll(text, "%appname%", options.appName);
    text = replaceAll(text, "%link%", options.link);
    text = replaceAll(text, "%subject%", options.subject);
    text = replaceAll(text, "%bodyTop%", options.bodyTop);
    text = replaceAll(text, "%body%", options.body);
    text = replaceAll(text, "%bodyBottom%", options.bodyBottom);
    text = replaceAll(text, "%button%", options.button);
    return text;
  }

  function getRecipient(user) {
      return user.get("email") || user.get('username')
  }

  var sendVerificationEmail = options => {
    if(mailgunOptions.verificationBodyHTML){

      // if use facebook login, canel mailing
      var authData = options.user.get("authData");
      if( authData && ( authData.facebook && authData.facebook.id ) ){
        return;
      }

      options = getEmailMessages( "Verification", options );

      var mail = mailcomposer({
        from: {
          name: mailgunOptions.displayName ?
            mailgunOptions.displayName :
            options.appName,
          address: mailgunOptions.fromAddress
        },
        to: getRecipient(options.user),
        subject: fillVariables(mailgunOptions.verificationSubject, options),
        text: fillVariables(mailgunOptions.verificationBody, options),
        html: fillVariables(mailgunOptions.verificationBodyHTML, options)
      });
      return new Promise((resolve, reject) => {
        mail.build((mailBuildError, message) => {
          if(mailBuildError){
            return reject(mailBuildError);
          }
          var dataToSend = {
            to: getRecipient(options.user),
            message: message.toString('ascii')
          };
          mailgun.messages().sendMime(dataToSend, (err, body) => {
            if (err) {
              return reject(err);
            }
            resolve(body);
          });
        });
      });
    }else{
      var data = {
        from: {
          name: mailgunOptions.displayName ?
            mailgunOptions.displayName :
            options.appName,
          address: mailgunOptions.fromAddress
        },
        to: getRecipient(options.user),
        subject: fillVariables(mailgunOptions.verificationSubject, options),
        text: fillVariables(mailgunOptions.verificationBody, options)
      }
      return new Promise((resolve, reject) => {
        mailgun.messages().send(data, (err, body) => {
          if (err) {
            reject(err);return;
          }
          resolve(body);
        });
      });
    }
  }

  var sendPasswordResetEmail = options => {
    if(mailgunOptions.passwordResetBodyHTML){

      options = getEmailMessages( "PasswordReset", options );

      var mail = mailcomposer({
        from: {
          name: mailgunOptions.displayName ?
            mailgunOptions.displayName :
            options.appName,
          address: mailgunOptions.fromAddress
        },
        to: getRecipient(options.user),
        subject: fillVariables(mailgunOptions.passwordResetSubject, options),
        text: fillVariables(mailgunOptions.passwordResetBody, options),
        html: fillVariables(mailgunOptions.passwordResetBodyHTML, options)
      })

      return new Promise((resolve, reject) => {
        mail.build((mailBuildError, message) => {
          if(mailBuildError){
            return reject(mailBuildError);
          }
          var dataToSend = {
            to: getRecipient(options.user),
            message: message.toString('ascii')
          };

          mailgun.messages().sendMime(dataToSend, (err, body) => {
            if (err) {
              return reject(err);
            }
            resolve(body);
          });
        });
      });
    }else{
      var data = {
        from: {
          name: mailgunOptions.displayName ?
            mailgunOptions.displayName :
            options.appName,
          address: mailgunOptions.fromAddress
        },
        to: getRecipient(options.user),
        subject: fillVariables(mailgunOptions.passwordResetSubject, options),
        text: fillVariables(mailgunOptions.passwordResetBody, options)
      }
      return new Promise((resolve, reject) => {
        mailgun.messages().send(data, (err, body) => {
          if (err) {
            reject(err);return;
          }
          resolve(body);
        });
      });
    }
  }

  var sendMail = options => {

    options = getEmailMessages( options.templateName, options );

    if( !options.html && mailgunOptions.defaultBodyHTML ){
      defaultBodyHTML = fs.readFileSync( path.join(process.cwd() , mailgunOptions.defaultBodyHTML.replace('file:', '') ),'utf8' );
    }

    var html = options.html?options.html:defaultBodyHTML;

    if(html){
      var mailC = mailcomposer({
        from: {
          name: mailgunOptions.displayName ?
            mailgunOptions.displayName :
            options.appName,
          address: mailgunOptions.fromAddress
        },
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: fillVariables( html, mail)
      });
      return new Promise((resolve, reject) => {
        mailC.build((mailBuildError, message) => {
          if(mailBuildError){
            return reject(mailBuildError);
          }
          var dataToSend = {
            to: options.to,
            message: message.toString('ascii')
          };

          mailgun.messages().sendMime(dataToSend, (err, body) => {
            if (err) {
              return reject(err);
            }
            resolve(body);
          });
        });
      });
    }else{
      var data = {
        from: {
          name: mailgunOptions.displayName ?
            mailgunOptions.displayName :
            options.appName,
          address: mailgunOptions.fromAddress
        },
        to: options.to,
        subject: options.subject,
        text: options.text
      }
      return new Promise((resolve, reject) => {
        mailgun.messages().send(data, (err, body) => {
          if (err) {
            return reject(err);
          }
          resolve(body);
        });
      });
    }
  }

  var getEmailMessages = function( templateName, options ){
    var currentLocale = options.locale || 'en';

    var langMessage = _messages[currentLocale] || _messages['en'];

    if( langMessage ){
      if( langMessage["Email"][templateName] ){
        var emailMessages = _messages[currentLocale]["Email"][templateName];
        if( emailMessages ){
          if( emailMessages.Body ){
            options.body = addVariables( emailMessages.Body, options );
          }
          if( emailMessages.BodyTop ){
            options.bodyTop = addVariables( emailMessages.BodyTop, options );
          }
          if( emailMessages.BodyBottom ){
            options.bodyBottom = addVariables( emailMessages.BodyBottom, options );
          }
          if( emailMessages.Button ){
            options.button = addVariables( emailMessages.Button, options);
          }
          if( emailMessages.Subject && ! options.subject ){
            options.subject = addVariables( emailMessages.Subject, options);
          }
        }
      }
    }

    return options;
  };

  var addVariables = function( message, options ){

    if( _customFillVariables ){
      message = _customFillVariables.execute(message, options);
    }

    return message;
  };

  return Object.freeze({
    sendVerificationEmail: sendVerificationEmail,
    sendPasswordResetEmail: sendPasswordResetEmail,
    sendMail: sendMail
  });
}

module.exports = SimpleMailgunAdapter
