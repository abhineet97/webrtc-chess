package main

import (
	"io"
	"log"
	"net/http"

	"golang.org/x/net/websocket"
)

var rooms map[string]*room

type room struct {
	users []*websocket.Conn
}

func echo(ws *websocket.Conn) {
	defer ws.Close()
	if ws.Config().Origin.Host != ws.Request().Host {
		return
	}
	var m string
	var r *room

	id := ws.Request().FormValue("id")
	if id == "" {
		m = "Error: No id supplied"
		if err := websocket.Message.Send(ws, m); err != nil {
			log.Printf("%v", err)
		}
		return
	}

	if _, ok := rooms[id]; !ok {
		rooms[id] = new(room)
	}
	r = rooms[id]
	r.users = append(r.users, ws)
	i := len(r.users) - 1

	for {
		err := websocket.Message.Receive(ws, &m)
		if err == io.EOF { //User Disconnected
			r.users = append(r.users[:i], r.users[i+1:]...)
			if len(r.users) == 0 {
				delete(rooms, id)
			}
			break
		} else if err != nil {
			log.Printf("%v", err)
		}
		for _, u := range r.users {
			if err := websocket.Message.Send(u, m); err != nil {
				log.Printf("%v", err)
			}
		}
	}
}

func main() {
	rooms = make(map[string]*room)

	http.Handle("/", http.FileServer(http.Dir("")))
	http.Handle("/ws", websocket.Handler(echo))
	http.ListenAndServe(":8080", nil)
	log.Println("Server running on http://localhost:8080")
}
