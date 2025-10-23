# Dyre (Dynamic Refresh)

This package is for displaying and "watching" images that are frequently updated, like plots that are regenerated after running a data analysis script.

It works by running a `node.js` server that watches the files that you specify. This is especially useful if you are doing data analysis remotely with scripts that frequently generate plots. This could also be a useful tool to check the progress of a long-running script if it makes plots as it progresses.

Of course you could notebook-style tools (`jupyter`/`marimo`/`pluto.jl`) to achieve something similar, but I wanted to make something agnostic of any particular language or framework. Also, really long data analysis pipelines often don't fit nicely into notebooks.

## Install

``` sh
npm install dyre
```

## Run

Usage:

``` sh
dyre -f <filename> -p <port>
```

`-f` opens a specific file
`-p` opens on a specific port, but defaults to 12301.

In your favorite browser, connect to:

``` md
http://localhost:12301/
```

And it should open a `dyre` session.

Put the **server-side absolute path** into the text box and hit *watch* to start watching the file.

Every time the file is changed, it will update the screen.

`ctrl-z` or `cmd-z` should work to undo anything like accidentally clearing all the plots.

`ctrl-shift-z` or `cmd-shift-z` should work to redo things as well.

The cards that hold the plot can be rearranged by dragging somewhere on the empty space that isn't the plot area. The plots themselves are pannable and zoomable as well. To reset the pan/zoom use the bottom left icon. To save the plot use the bottom right save button.

---

There is also a second script that you can run in the command line to send plots to the server. This is useful so that you don't have to copy paste absolute paths into the text box.

To open plots on the active session (make sure the server is running):

``` sh
dyopen pathtoplot.png
```

You can open multiple plots at the same time by adding the other files as multiple arguments.

Wildcards work too:

``` sh
dyopen plotsarehere/*.png
```

## To-do

* `.mp4` support (`.gif` works already I think)
