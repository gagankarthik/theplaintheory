import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from "@angular/core";
import { isAllowed, type Category } from "@theplaintheory/consent";
import { PlainConsentService } from "./plain-consent.service";

/**
 * Render a template only while a consent category is allowed, with an optional `else` template:
 * Angular's ConsentGate.
 *
 *   <iframe *plainConsentAllowed="'marketing'; else blocked" src="https://www.youtube.com/embed/…"></iframe>
 *   <ng-template #blocked><p>Allow marketing cookies to watch this video.</p></ng-template>
 */
@Directive({ selector: "[plainConsentAllowed]", standalone: true })
export class PlainConsentAllowedDirective {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private readonly consent = inject(PlainConsentService);

  readonly category = input.required<Category>({ alias: "plainConsentAllowed" });
  readonly elseTemplate = input<TemplateRef<unknown> | null>(null, { alias: "plainConsentAllowedElse" });

  private shown: TemplateRef<unknown> | null = null;

  constructor() {
    effect(() => {
      const next = isAllowed(this.category(), this.consent.state()) ? this.template : this.elseTemplate();
      if (next === this.shown) return;
      this.container.clear();
      if (next) this.container.createEmbeddedView(next);
      this.shown = next;
    });
  }
}
