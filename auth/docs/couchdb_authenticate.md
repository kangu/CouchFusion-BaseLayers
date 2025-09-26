The CouchDB module should implement an "authenticate" function that integrates with the CouchDB _session API.
Function parameters are username and password, it makes a POST request and on success, returns the AuthSession cookie.
Returns an empty string if authentication fails.
