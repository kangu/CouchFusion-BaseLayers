The CouchDB module should implement a createUser function for creating new users as documented at https://docs.couchdb.org/en/stable/intro/security.html#creating-a-new-user.
It accepts a payload of json data and merges that together with the needed fields as required by the _users security API.
Roles can be passed in that are to be appended to the regular "roles" key from the user doc.
The password is also a required parameter.
Makes the PUT request to the _users endpoint and returns the newly created doc.
