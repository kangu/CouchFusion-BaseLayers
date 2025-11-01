Inside layers/content/app/components/admin/ContentImageField.vue, extend the list of actions
with "Browse Local". That should open up a dialog similar to the one used for imagekit,
but returning data from the local server querying the public/images folder (server route and file
lookup functionality needs to be implemented).

From that dialog, the user has the option to upload a new image or select an existing one from the local server. When uploading the new image, the file is copied to the public/images folder through
a newly implemented API handler route inside the content module.

The user also has the ability to delete an existing image from the local server.