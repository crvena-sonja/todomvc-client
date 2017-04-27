/*global jQuery, Handlebars, Router */
jQuery(function ($) {
  'use strict';

  Handlebars.registerHelper('eq', function (a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
  });

  var ENTER_KEY = 13;
  var ESCAPE_KEY = 27;

  var util = {
    uuid: function () {
      /*jshint bitwise:false */
      var i, random;
      var uuid = '';

      for (i = 0; i < 32; i++) {
        random = Math.random() * 16 | 0;
        if (i === 8 || i === 12 || i === 16 || i === 20) {
          uuid += '-';
        }
        uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
      }

      return uuid;
    },
    pluralize: function (count, word) {
      return count === 1 ? word : word + 's';
    },
    store: function (namespace, data) {
      if (arguments.length > 1) {
        return localStorage.setItem(namespace, JSON.stringify(data));
      } else {
        var store = localStorage.getItem(namespace);
        return (store && JSON.parse(store)) || [];
      }
    }
  };

  var App = {
    init: function (data) {
      // this.todos = util.store('todos-jquery');
      this.todos = data;

      this.todoTemplate = Handlebars.compile($('#todo-template').html());
      this.footerTemplate = Handlebars.compile($('#footer-template').html());
      this.bindEvents();

      new Router({
        '/:filter': function (filter) {
          this.filter = filter;
          this.render();
        }.bind(this)
      }).init('/all');
    },
    bindEvents: function () {
      $('#new-todo').on('keyup', this.create.bind(this));
      $('#toggle-all').on('change', this.toggleAll.bind(this));
      $('#footer').on('click', '#clear-completed', this.destroyCompleted.bind(this));
      $('#todo-list')
        .on('change', '.toggle', this.toggle.bind(this))
        .on('dblclick', 'label', this.editingMode.bind(this))
        .on('keyup', '.edit', this.editKeyup.bind(this))
        .on('focusout', '.edit', this.update.bind(this))
        .on('click', '.destroy', this.destroy.bind(this));
    },
    render: function () {
      var todos = this.getFilteredTodos();
      $('#todo-list').html(this.todoTemplate(todos));
      $('#main').toggle(todos.length > 0);
      $('#toggle-all').prop('checked', this.getActiveTodos().length === 0);
      this.renderFooter();
      $('#new-todo').focus();
      // util.store('todos-jquery', this.todos);
    },
    renderFooter: function () {
      var todoCount = this.todos.length;
      var activeTodoCount = this.getActiveTodos().length;
      var template = this.footerTemplate({
        activeTodoCount: activeTodoCount,
        activeTodoWord: util.pluralize(activeTodoCount, 'item'),
        completedTodos: todoCount - activeTodoCount,
        filter: this.filter
      });

      $('#footer').toggle(todoCount > 0).html(template);
    },
    toggleAll: function (e) {
      var isChecked = $(e.target).prop('checked');
      this.todos.forEach(function (todo) {
        todo.completed = isChecked;
      });

      this.render();
    },
    getActiveTodos: function () {
      return this.todos.filter(function (todo) {
        return !todo.completed;
      });
    },
    getCompletedTodos: function () {
      return this.todos.filter(function (todo) {
        return todo.completed;
      });
    },
    getFilteredTodos: function () {
      if (this.filter === 'active') {
        return this.getActiveTodos();
      }

      if (this.filter === 'completed') {
        return this.getCompletedTodos();
      }

      return this.todos;
    },
    destroyCompleted: function () {
      var app = this;
      var promises = [];

      this.getCompletedTodos().forEach(function(todo) {
        var promise = $.ajax({
          type: 'DELETE',
          url: todo.url,
          contentType: 'application/json',
          dataType: 'json'
        });
        promises.push(promise);
      });

      Promise.all(promises)
        .then(function(){
          app.todos = app.getActiveTodos();
          app.filter = 'all';
          app.render();
        })
        .catch(function(err){
          console.error(err);

        });
    },
    // accepts an element from inside the `.item` div and
    // returns the corresponding index in the `todos` array
    getIndexFromEl: function (el) {
      var id = $(el).closest('li').data('id');
      var todos = this.todos;
      var i = todos.length;

      while (i--) {
        if (todos[i].id === id) {
          return i;
        }
      }
    },
    create: function (e) {
      var app = this;
      var $input = $(e.target);
      var val = $input.val().trim();

      if (e.which !== ENTER_KEY || !val) {
        return;
      }
      /// POST
      // this.todos.push({
      //   id: util.uuid(),
      //   title: val,
      //   completed: false
      // });

      $.ajax({
        type: 'POST',
        url: 'http://localhost:8080/api/items',
        data: JSON.stringify({
          title: val,
          completed: false
        }),
        contentType: 'application/json',
        dataType: 'json',
        success: function (data) {
          console.log(data);
          app.todos.push(data);
          $input.val('');
          app.render();
        },
      });

      // $input.val('');
      // this.render();
    },
    toggle: function (e) {
      var app = this;
      var i = this.getIndexFromEl(e.target);
      /// PUT		      
      this.todos[i].completed = !this.todos[i].completed;

      $.ajax({
        type: 'PUT',
        url: this.todos[i].url,
        data: JSON.stringify(this.todos[i]),
        contentType: 'application/json',
        dataType: 'json',
        success: function (data) {
          console.log(data);
          app.render();
        },
      });

      // this.render();
    },
    editingMode: function (e) {
      var $input = $(e.target).closest('li').addClass('editing').find('.edit');
      $input.val($input.val()).focus();
    },
    editKeyup: function (e) {
      if (e.which === ENTER_KEY) {
        e.target.blur();
      }

      if (e.which === ESCAPE_KEY) {
        $(e.target).data('abort', true).blur();
      }
    },
    update: function (e) {
      var app = this;
      var el = e.target;
      var $el = $(el);
      var val = $el.val().trim();
      var i = this.getIndexFromEl(e.target);

      if (!val) {
        this.destroy(e);
        return;
      }

      /// PUT
      if ($el.data('abort')) {
        $el.data('abort', false);
      }
      else {
        this.todos[i].title = val;

        $.ajax({
          type: 'PUT',
          url: this.todos[i].url,
          data: JSON.stringify(this.todos[i]),
          contentType: 'application/json',
          dataType: 'json',
          success: function (data) {
            console.log(data);
            app.render();
          },
        });
      }



      // this.render();
    },
    destroy: function (e) {
      /// DELETE
      var app = this;
      var i = this.getIndexFromEl(e.target);

      $.ajax({
        type: 'DELETE',
        url: this.todos[i].url,
        // data: JSON.stringify(this.todos[i]),
        contentType: 'application/json',
        dataType: 'json',
        success: function (data) {
          console.log(data);
          app.todos.splice(i, 1);
          app.render();
        },
      });

      this.render();
    }
  };

  /// GET
  $.ajax({
    type: 'GET',
    url: 'http://localhost:8080/api/items',
    contentType: 'application/json',
    dataType: 'json',
    success: function (data) {
      console.log(data);
      App.init(data);
    },
  });

});
