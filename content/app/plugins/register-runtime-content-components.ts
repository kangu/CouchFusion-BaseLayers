import Content from "../components/runtime/content/Content.vue";
import ContentMarginWrapper from "../components/runtime/ContentMarginWrapper.vue";

export default defineNuxtPlugin(({ vueApp }) => {
  vueApp.component("Content", Content);
  vueApp.component("ContentMarginWrapper", ContentMarginWrapper);
});
