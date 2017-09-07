// Copyright © 2017 The Free Chess Club <help@freechess.club>
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"net/http"
	"net/url"
	"os"

	"github.com/Sirupsen/logrus"
	"github.com/gorilla/handlers"
	"github.com/gorilla/websocket"
)

var (
	log = logrus.New()
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     checkSameOrigin,
	}
)

func checkSameOrigin(r *http.Request) bool {
	if r.UserAgent() == "The Free Chess Club" {
		return true
	}

	origin := r.Header["Origin"]
	if len(origin) == 0 {
		return true
	}
	u, err := url.Parse(origin[0])
	if err != nil {
		return false
	}
	return u.Host == r.Host
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
		log.Println("Using default port 8080")
	}

	http.HandleFunc("/ws", handleWebsocket)
	http.HandleFunc("/favicon.ico", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./public/assets/img/favicon.ico")
	})
	http.HandleFunc("/privacy", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./public/privacy.html")
	})
	http.HandleFunc("/contact/submit", handleContact)
	http.HandleFunc("/contact", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./public/contact.html")
	})
	http.HandleFunc("/play", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./public/play.html")
	})
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./public/"+r.URL.Path[1:])
	})
	w := log.Writer()
	defer w.Close()
	log.Println(http.ListenAndServe(":"+port, handlers.LoggingHandler(w, http.DefaultServeMux)))
}
