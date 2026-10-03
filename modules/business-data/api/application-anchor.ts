export interface ApplicationAnchorV010 {
  readonly applicationId: string;
}

export interface ApplicationAnchorReaderV010 {
  require(applicationId: string): Promise<ApplicationAnchorV010>;
}

export interface ApplicationAnchorRegistryV010
  extends ApplicationAnchorReaderV010 {
  register(anchor: ApplicationAnchorV010): Promise<void>;
}
