export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive("analytics", {
    getSSRProps() {
      return {};
    },
  });
});
