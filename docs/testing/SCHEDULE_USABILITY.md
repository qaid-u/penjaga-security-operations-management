# Duty schedule usability

The daily schedule groups shifts under each post. Pagination counts posts, rather than repeating the same post for every shift. All posts are shown initially so an assigned post does not disappear when its requirement is met.

## Scheduling a guard

1. Choose the schedule week and tap a day.
2. Search for a post or building. Use **Tapis** for building/shift filters, or **Perlu pengawal** to focus on shortages.
3. Open a post and choose **Tugaskan pengawal** for the relevant shift.
4. Search/select a guard, check the prefilled date/post/shift, then save. The existing conflict endpoint runs automatically before saving.

The assignment dialog retains explicit controls for changing the date, post, shift, times and optional notes. Phone dialogs sit at the bottom of the viewport with a scrollable body and fixed action footer. Native modal behavior handles focus and Escape; closing and inputs are disabled while saving. Failed conflict requests display an inline error and allow retrying.

Admin settings/import remain in a separate view. Chiefs see why locked schedules cannot be edited. Guard schedules use readable dates, shift times, overnight indicators and the existing check-in/check-out eligibility rules.

Assignments returned by coverage without a configured minimum requirement also appear under the post, with **Tiada minimum ditetapkan**, so manual assignments can be found and edited.

## Checks

`schedule-usability.spec.mjs` exercises grouped shifts across 25 posts, completed-post discovery, search, a phone assignment with a selected day and overnight shift, conflict prevention, locked-chief restrictions and manual assignments outside minimum requirements. Screenshots cover desktop and phone layouts; overflow checks cover 320, 390 and 768 pixels.

Existing mobile, recovery and usability browser checks cover building filters, pagination, date changes, deletion confirmation, failed conflict checks, settings/import and navigation. Browser fixtures intercept API calls and do not insert or delete operational records. These UI changes do not alter the database or API schema.
