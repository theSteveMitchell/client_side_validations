/*!
 * Rails 3 Client Side Validations - v3.1.0
 * https://github.com/bcardarella/client_side_validations
 *
 * Copyright (c) 2011 Brian Cardarella
 * Licensed under the MIT license
 * http://www.opensource.org/licenses/mit-license.php
 */

(function ($) {
  $.fn.validate = function () {
    return this.filter('form[data-validate]').each(function () {
      var form = $(this),
          settings = window['ClientSideValidations']['forms'][form.attr('id')],
          addError = function (element, message) {
            ClientSideValidations.formBuilders[settings.type].add(element, settings, message);
          },
          removeError = function (element) {
            ClientSideValidations.formBuilders[settings.type].remove(element, settings);
          };

      // Set up the events for the form
      form
        .submit(                      function ()          { return form.isValid(settings.validators); })
        .bind('ajax:beforeSend',      function (eventData) { if(eventData.target == this) return form.isValid(settings.validators); })
        // Callbacks
        .bind('form:validate:after',  function (eventData) { ClientSideValidations.callbacks.form.after( form, eventData); } )
        .bind('form:validate:before', function (eventData) { ClientSideValidations.callbacks.form.before(form, eventData); } )
        .bind('form:validate:fail',   function (eventData) { ClientSideValidations.callbacks.form.fail(  form, eventData); } )
        .bind('form:validate:pass',   function (eventData) { ClientSideValidations.callbacks.form.pass(  form, eventData); } )

        // Set up the events for each validatable form element
        .find('[data-validate="true"]:input:enabled:not(:radio)')
          .live('focusout',                function ()          { $(this).isValid(settings.validators); })
          .live('change',                  function ()          { $(this).data('changed', true); })
          // Callbacks
          .live('element:validate:after',  function (eventData) { ClientSideValidations.callbacks.element.after( $(this), eventData); })
          .live('element:validate:before', function (eventData) { ClientSideValidations.callbacks.element.before($(this), eventData); })
          .live('element:validate:fail',   function (eventData, message) {
            var element = $(this);
            ClientSideValidations.callbacks.element.fail(element, message, function () {
              addError(element, message);
            }, eventData); })
          .live('element:validate:pass',   function (eventData) {
            var element = $(this);
            ClientSideValidations.callbacks.element.pass(element, function () {
              removeError(element);
            }, eventData); })
        // Checkboxes - Live events don't support filter
        .end().find('[data-validate="true"]:checkbox')
          .live('click', function () { $(this).isValid(settings.validators); })
        // Inputs for confirmations
        .end().find('[id*=_confirmation]').each(function () {
          var confirmationElement = $(this),
              element = form.find('#' + this.id.match(/(.+)_confirmation/)[1] + '[data-validate="true"]:input');

          if (element[0]) {
            $('#' + confirmationElement.attr('id'))
              .live('focusout', function () {
                element.data('changed', true).isValid(settings.validators);
              })
              .live('keyup', function () {
                element.data('changed', true).isValid(settings.validators);
              });
          }
        });

    });
  };

  $.fn.isValid = function (validators) {
    if ($(this[0]).is('form')) {
      return validateForm($(this[0]), validators);
    } else {
      return validateElement($(this[0]), validators[this[0].name]);
    }
  };

  var validateForm = function (form, validators) {
    var valid = true;

    form.trigger('form:validate:before').find('[data-validate="true"]:input:enabled').each(function() {
      if (!$(this).isValid(validators)) { valid = false; }
    });

    if (valid) {
      form.trigger('form:validate:pass');
    } else {
      form.trigger('form:validate:fail');
    }

    form.trigger('form:validate:after');
    return valid;
  },
    validateElement = function (element, validators) {
      element.trigger('element:validate:before');

      if (element.data('changed') !== false) {
        var valid = true;
        element.data('changed', false);

        // Because 'length' is defined on the list of validators we cannot call jQuery.each on
        for (kind in ClientSideValidations.validators.local) {
          if (validators[kind] && (message = ClientSideValidations.validators.all()[kind](element, validators[kind]))) {
            element.trigger('element:validate:fail', message).data('valid', false);
            valid = false;
            break;
          }
        }

        if (valid) {
          for (kind in ClientSideValidations.validators.remote) {
            if (validators[kind] && (message = ClientSideValidations.validators.all()[kind](element, validators[kind]))) {
              element.trigger('element:validate:fail', message).data('valid', false);
              valid = false;
              break;
            }
          }
        }

        if (valid) { element.data('valid', null); element.trigger('element:validate:pass'); }
      }

      element.trigger('element:validate:after');
      return element.data('valid') === false ? false : true;
    };

  // Main hook
  // If new forms are dynamically introduced into the DOM the .validate() method
  // must be invoked on that form
  $(function () { $('form[data-validate]').validate(); });
})(jQuery);

var ClientSideValidations = {
  forms: {},
  validators: {
    all: function() { return jQuery.extend({}, ClientSideValidations.validators.local, ClientSideValidations.validators.remote); },
    local: {
      presence: function (element, options) {
        if (/^\s*$/.test(element.val() || "")) {
          return options.message;
        }
      },
      acceptance: function (element, options) {
        switch (element.attr('type')) {
          case 'checkbox':
            if (!element.attr('checked')) {
              return options.message;
            }
            break;
          case 'text':
            if (element.val() != (options.accept || '1')) {
              return options.message;
            }
            break;
        }
      },
      format: function (element, options) {
        if ((message = this.presence(element, options)) && options.allow_blank === true) {
          return;
        } else if (message) {
          return message;
        } else {
          if (options['with'] && !options['with'].test(element.val())) {
            return options.message;
          } else if (options['without'] && options['without'].test(element.val())) {
            return options.message;
          }
        }
      },
      numericality: function (element, options) {
        if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?$/.test(element.val())) {
          return options.messages.numericality;
        }

        if (options.only_integer && !/^[+-]?\d+$/.test(element.val())) {
          return options.messages.only_integer;
        }

        var CHECKS = { greater_than: '>', greater_than_or_equal_to: '>=',
          equal_to: '==', less_than: '<', less_than_or_equal_to: '<=' };

        for (check in CHECKS) {
          if (options[check] !== undefined && !(new Function("return " + element.val() + CHECKS[check] + options[check])())) {
            return options.messages[check];
          }
        }

        if (options.odd && !(parseInt(element.val(), 10) % 2)) {
          return options.messages.odd;
        }

        if (options.even && (parseInt(element.val(), 10) % 2)) {
          return options.messages.even;
        }
      },
      length: function (element, options) {
        var blankOptions = {},
            CHECKS = { is: '==', minimum: '>=', maximum: '<=' },
            tokenizer = options.js_tokenizer || "split('')",
            tokenized_length = new Function("element", "return (element.val()." + tokenizer + " || '').length;")(element);
        if (options.is) {
          blankOptions.message = options.messages.is;
        } else if (options.minimum) {
          blankOptions.message = options.messages.minimum;
        }
        if ((message = this.presence(element, blankOptions)) && options.allow_blank === true) {
          return;
        } else if (message) {
          return message;
        } else {
          for (check in CHECKS) {
            if (options[check] && !(new Function("return " + tokenized_length + CHECKS[check] + options[check])())) {
              return options.messages[check];
            }
          }
        }
      },
      exclusion: function (element, options) {
        var lower = null, upper = null;
        if ((message = this.presence(element, options)) && options.allow_blank === true) {
          return;
        } else if (message) {
          return message;
        } else {
          if (options['in']) {
            for (i = 0; i < options['in'].length; i = i + 1) {
              if (options['in'][i] == element.val()) {
                return options.message;
              }
            }
          } else if (options.range) {
            lower = options.range[0];
            upper = options.range[1];
            if (element.val() >= lower && element.val() <= upper) {
              return options.message;
            }
          }
        }
      },
      inclusion: function (element, options) {
        var lower = null, upper = null;
        if ((message = this.presence(element, options)) && options.allow_blank === true) {
          return;
        } else if (message) {
          return message;
        } else {
          if (options['in']) {
            for (i = 0; i < options['in'].length; i = i + 1) {
              if (options['in'][i] == element.val()) {
                return;
              }
            }
            return options.message;
          } else if (options.range) {
            lower = options.range[0];
            upper = options.range[1];

            if (element.val() >= lower && element.val() <= upper) {
              return;
            } else {
              return options.message;
            }
          }
        }
      },
      confirmation: function (element, options) {
        if (element.val() !== jQuery('#' + element.attr('id') + '_confirmation').val()) {
          return options.message;
        }
      }
    },
    remote: {
      uniqueness: function (element, options) {
        if ((message = ClientSideValidations.validators.local.presence(element, options)) && options.allow_blank === true) {
          return;
        } else if (message) {
          return message;
        } else {
          var data = {},
              name = null;
          data.case_sensitive = !!options.case_sensitive;
          if (options.id) {
            data.id = options.id;
          }

          if (options.scope) {
            data.scope = {};
            for (key in options.scope) {
              var scoped_element = jQuery('[name="' + element.attr('name').replace(/\[\w+\]$/, '[' + key + ']' + '"]'));
              if (scoped_element[0] && scoped_element.val() !== options.scope[key]) {
                data.scope[key] = scoped_element.val();
                scoped_element.unbind('change.' + element.id).bind('change.' + element.id, function() { element.trigger('change'); element.trigger('focusout'); });
              } else {
                data.scope[key] = options.scope[key];
              }
            }
          }

          // Kind of a hack but this will isolate the resource name and attribute.
          // e.g. user[records_attributes][0][title] => records[title]
          // e.g. user[record_attributes][title] => record[title]
          // Server side handles classifying the resource properly
          if (/_attributes\]/.test(element.attr('name'))) {
            name = element.attr('name').match(/\[\w+_attributes\]/g).pop().match(/\[(\w+)_attributes\]/).pop();
            name += /(\[\w+\])$/.exec(element.attr('name'))[1];
          } else {
            name = element.attr('name');
          }

          // Override the name if a nested module class is passed
          if (options['class']) {
            name = options['class'] + '[' + name.split('[')[1];
          }
          data[name] = element.val();

          if (jQuery.ajax({
            url: '/validators/uniqueness',
            data: data,
            async: false
          }).status === 200) {
            return options.message;
          }
        }
      }
    }
  },
  formBuilders: {
    'ActionView::Helpers::FormBuilder': {
      add: function(element, settings, message) {
        if (element.data('valid') !== false && jQuery('label.validations_message[for="' + element.attr('id') + '"]')[0] == undefined) {

            var formBeingValidated = element.closest("form")
            var inputErrorField = jQuery(settings.input_tag),
              labelErrorField = jQuery(settings.label_tag),
              label = jQuery('label[for="' + element.attr('id') + '"]:not(.validations_message)', formBeingValidated);

          if (element.attr('autofocus')) { element.attr('autofocus', false) };
          label.after(inputErrorField);
          inputErrorField.find('span#input_tag').replaceWith(element);
          inputErrorField.find('label.validations_message').attr('for', element.attr('id'));
          labelErrorField.find('label.validations_message').attr('for', element.attr('id'));
          label.replaceWith(labelErrorField);
          labelErrorField.find('label#label_tag').replaceWith(label);
          //label.toggle();
        }
        jQuery('label.validations_message[for="' + element.attr('id') + '"]').text(message);

      },
      remove: function(element, settings) {
          var formBeingValidated = element.closest("form")
          var errorFieldClass = jQuery(settings.input_tag).attr('class'),
            inputErrorField = element.closest('.' + errorFieldClass),
            label = jQuery('label[for="' + element.attr('id') + '"]:not(.validations_message)', formBeingValidated),
            labelErrorField = label.closest('.' + errorFieldClass);

        if (inputErrorField[0]) {
          inputErrorField.find('#' + element.attr('id')).detach();
          inputErrorField.replaceWith(element);
          label.detach();
          labelErrorField.replaceWith(label);
          //label.toggle();
        }
      }
    },
  callbacks: {
    element: {
      after:  function (element, eventData)                    { },
      before: function (element, eventData)                    { },
      fail:   function (element, message, addError, eventData) { addError(); },
      pass:   function (element, removeError, eventData)       { removeError(); }
    },
    form: {
      after:  function (form, eventData) { },
      before: function (form, eventData) { },
      fail:   function (form, eventData) { },
      pass:   function (form, eventData) { }
    }
  }
};
