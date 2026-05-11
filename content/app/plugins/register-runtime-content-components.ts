import Content from "../components/runtime/content/Content.vue";
import ContentMarginWrapper from "../components/runtime/ContentMarginWrapper.vue";

export default defineNuxtPlugin(({ vueApp }) => {
  if (!vueApp.component("Content")) {
    vueApp.component("Content", Content);
  }
  if (!vueApp.component("ContentMarginWrapper")) {
    vueApp.component("ContentMarginWrapper", ContentMarginWrapper);
  }
});
