export interface ApplicationAnchorV010 {
  readonly applicationId: string;
}

export interface ApplicationAnchorRegistryV010 {
  exists(applicationId: string): Promise<boolean>;
  register(anchor: ApplicationAnchorV010): Promise<void>;
}
