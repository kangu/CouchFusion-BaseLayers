The imagekit layer should provide a global directive that would help <img> tags apply transformations 
to the loaded imagekit url.
Consider that the images are loaded using v-lazy, something like this:

<img
v-lazy="member.image"
src="data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA="
:alt="member.name"
class="rounded-2xl object-cover w-full h-full"
/>

I want to have a way to apply transformations, either one or multiple.

Single transformation example:

tr:w-500

Applied to the image like

https://ik.imagekit.io/bitvocation/content-editor/tr:w-500/Mindaugas_240306_Linkedin_4_HD29luOFw.jpg?updatedAt=1760093079083

(so the transformation goes between the root of the url and the path destination).

When multiple transformations are applied, they look like this:

tr:w-300,h-300
