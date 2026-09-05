# Component Host Elements

The **host element** is the DOM element that matches a component's selector. The component's template renders inside this element.

## Binding to the Host Element

Use the `host` property in the `@Component` decorator to bind properties, attributes, styles, and events to the host element.

```ts
@Component({
  selector: 'custom-slider',
  host: {
    'role': 'slider', // Static attribute
    '[attr.aria-valuenow]': 'value', // Attribute binding
    '[class.active]': 'isActive()', // Class binding
    '[style.color]': 'color()', // Style binding
    '[tabIndex]': 'disabled ? -1 : 0', // Property binding
    '(keydown)': 'onKeyDown($event)', // Event binding
  },
})
export class CustomSlider {
  protected readonly value = 0;
  protected readonly disabled = false;
  protected readonly isActive = signal(false);
  protected readonly color = signal('blue');

  onKeyDown(event: KeyboardEvent) {
    /* ... */
  }
}
```

## Binding Collisions

If both the component (host binding) and the consumer (template binding) bind to the same property:

1. **Static vs Static**: The instance (consumer) binding wins.
2. **Static vs Dynamic**: The dynamic binding wins.
3. **Dynamic vs Dynamic**: The component's host binding wins.

## Injecting Host Attributes

Use `HostAttributeToken` with the `inject` function to read static attributes from the host element at construction time.

```ts
import {Component, HostAttributeToken, inject} from '@angular/core';

@Component({
  selector: 'app-btn',
  template: `<ng-content />`,
})
export class AppButton {
  // Throws error if 'type' is missing unless injected with { optional: true }
  type = inject(new HostAttributeToken('type'));
}
```

Usage:

```html
<app-btn type="primary">Click Me</app-btn>
```
