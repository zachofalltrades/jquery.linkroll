module.exports = function(grunt) {
    grunt.initConfig({
        // Import package manifest
        pkg: grunt.file.readJSON("package.json"),
        // Banner definitions
        meta: {
            banner: "/**\n" +
                " * <%= pkg.title || pkg.name %> - v<%= pkg.version %> <%= grunt.template.today('yyyy-mm-dd') %>\n" +
                " * <%= pkg.description %>\n" +
                " * <%= pkg.homepage %>\n" +
                " *\n" +
                " * Copyright (c)<%= grunt.template.today('yyyy') %> <%= pkg.author.name %>\n" +
                " * <<%= pkg.author.email %>>  (<%= pkg.author.url %>)\n" +
                " * Released Under License:  <%= pkg.licenses %> \n" +
                " */\n"
        },
        // Concat definitions
        concat: {
            dist: {
                src: ["src/jquery.linkroll.js"],
                dest: "dist/jquery.linkroll.js"
            },
            options: {
                banner: "<%= meta.banner %>"
            }
        },
        // Lint definitions
        jshint: {
            files: ["src/jquery.linkroll.js"],
            options: {
                jshintrc: ".jshintrc"
            }
        },
        // Minify definitions
        uglify: {
            my_target: {
                src: ["dist/jquery.linkroll.js"],
                dest: "dist/jquery.linkroll.min.js"
            },
            options: {
                banner: "<%= meta.banner %>"
            }
        },
        // watch for changes to source
        // Better than calling grunt a million times
        // (call 'grunt watch')
        watch: {
            files: ["src/*"],
            tasks: ["default"]
        },
        // update bower.json with data from package.json
        update_json: {
            options: {
                src: "package.json",
                indent: "  "
            },
            bower: {
                dest: 'bower.json', // where to write to
                // the fields to update, as a String Grouping
                fields: { //to:   "from",
                    name: "name",
                    version: "version",
                    description: "description",
                    repository: "repository",
                    keywords: "keywords",
                    homepage: "homepage",
                    main: "main",
                    license: "licenses",
                    authors: [{
                        name: "/author/name",
                        email: "/author/email",
                        homepage: "/author/url"
                    }]
                }
                //TODO: handle special cases for author/contributor obj/str formats
                //TODO: handle 'private'
            }
        },
        bump: {
            options: {
                files: ['package.json', 'bower.json'],
                updateConfigs: ['pkg'],
                commit: true,
                commitMessage: 'Release v%VERSION%',
                commitFiles: ['-a'],
                createTag: true,
                tagName: 'v%VERSION%',
                tagMessage: 'Version %VERSION%',
                push: true,
                pushTo: 'origin',
                gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d',
                globalReplace: false,
                prereleaseName: false,
                regExp: false
            }
        }

    });
    require('load-grunt-tasks')(grunt); //DRY replacement for loadNpmTasks()

    grunt.registerTask("build", ["concat", "uglify", "update_json"]);
    grunt.registerTask("default", ["jshint", "build"]);
    grunt.registerTask("release", ["bump"]);
    grunt.registerTask("travis", ["default"]);
};
