package main

import (
	"io"
	"log"
	"net/http"

	"golang.org/x/net/websocket"
)

var rooms map[string]*room

type room struct {
	id    string
	users map[*websocket.Conn]bool
}

func (r *room) addUser(ws *websocket.Conn) {
	r.users[ws] = true
}

func (r *room) removeUser(ws *websocket.Conn) {
	delete(r.users, ws)
	if len(r.users) == 0 {
		delete(rooms, r.id)
	}
}

func echo(ws *websocket.Conn) {
	defer ws.Close()

	if ws.Config().Origin.Host != ws.Request().Host {
		return
	}

	id := ws.Request().FormValue("id")
	if _, ok := rooms[id]; !ok {
		rooms[id] = &room{id, make(map[*websocket.Conn]bool)}
	}
	r := rooms[id]
	r.addUser(ws)

	var m string
	for {
		err := websocket.Message.Receive(ws, &m)
		if err == io.EOF { //User Disconnected
			r.removeUser(ws)
			break
		} else if err != nil {
			log.Print(err)
		}

		for u := range r.users {
			if err := websocket.Message.Send(u, m); err != nil {
				log.Print(err)
			}
		}
	}
}

func main() {
	rooms = make(map[string]*room)

	http.Handle("/", http.FileServer(http.Dir("")))
	http.Handle("/ws", websocket.Handler(echo))
	http.ListenAndServe(":8080", nil)
}
