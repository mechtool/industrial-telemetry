function(ctx) {
  identity_id: if std.objectHas(ctx, 'identity') then ctx.identity.id else null,
  email: if std.objectHas(ctx, 'identity') && std.objectHas(ctx.identity, 'traits') then ctx.identity.traits.email else null,
  username: if std.objectHas(ctx, 'identity') && std.objectHas(ctx.identity, 'traits') then ctx.identity.traits.username else null,
}
