import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'issueNumber' })
export class IssueNumberPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value == null ? '' : `#${value}`;
  }
}
